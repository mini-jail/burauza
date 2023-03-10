const Error = Symbol();
const Queue = new Set();
let nodeQueue;
let parentNode;
function scoped(callback) {
    const node = createNode();
    parentNode = node;
    try {
        return batch(()=>{
            let _cleanup = undefined;
            if (callback.length) {
                _cleanup = cleanNode.bind(undefined, node, true);
            }
            return callback(_cleanup);
        });
    } catch (error) {
        handleError(error);
    } finally{
        parentNode = node.parentNode;
    }
}
function createNode(initialValue, callback) {
    const node = {
        value: initialValue,
        parentNode,
        children: undefined,
        injections: undefined,
        cleanups: undefined,
        callback,
        sources: undefined,
        sourceSlots: undefined
    };
    if (parentNode) {
        if (parentNode.children === undefined) {
            parentNode.children = [
                node
            ];
        } else {
            parentNode.children.push(node);
        }
    }
    return node;
}
function onMount(callback) {
    effect(()=>untrack(callback));
}
function onDestroy(callback) {
    onCleanup(()=>untrack(callback));
}
function on(dependency, callback) {
    return (current)=>{
        dependency();
        return untrack(()=>callback(current));
    };
}
function effect(callback, initialValue) {
    if (parentNode) {
        const node = createNode(initialValue, callback);
        if (nodeQueue) nodeQueue.add(node);
        else queueMicrotask(()=>updateNode(node, false));
    } else {
        queueMicrotask(()=>callback(initialValue));
    }
}
function lookup(node, id) {
    return node ? node.injections && id in node.injections ? node.injections[id] : lookup(node.parentNode, id) : undefined;
}
function createSource(initialValue) {
    return {
        value: initialValue,
        nodes: undefined,
        nodeSlots: undefined
    };
}
function getSourceValue(source) {
    if (parentNode && parentNode.callback) {
        const sourceSlot = source.nodes?.length || 0, nodeSlot = parentNode.sources?.length || 0;
        if (parentNode.sources === undefined) {
            parentNode.sources = [
                source
            ];
            parentNode.sourceSlots = [
                sourceSlot
            ];
        } else {
            parentNode.sources.push(source);
            parentNode.sourceSlots.push(sourceSlot);
        }
        if (source.nodes === undefined) {
            source.nodes = [
                parentNode
            ];
            source.nodeSlots = [
                nodeSlot
            ];
        } else {
            source.nodes.push(parentNode);
            source.nodeSlots.push(nodeSlot);
        }
    }
    return source.value;
}
function setSourceValue(source, value) {
    if (typeof value === "function") value = value(source.value);
    source.value = value;
    if (source.nodes?.length) {
        batch(()=>{
            for (const node of source.nodes){
                nodeQueue.add(node);
            }
        });
    }
}
function sourceValue(source, value) {
    return arguments.length === 1 ? getSourceValue(source) : setSourceValue(source, value);
}
function signal(initialValue) {
    const source = createSource(initialValue);
    return sourceValue.bind(undefined, source);
}
function handleError(error) {
    const errorCallbacks = lookup(parentNode, Error);
    if (!errorCallbacks) return reportError(error);
    for (const callback of errorCallbacks){
        callback(error);
    }
}
function onCleanup(callback) {
    if (parentNode === undefined) return;
    else if (!parentNode.cleanups) parentNode.cleanups = [
        callback
    ];
    else parentNode.cleanups.push(callback);
}
function untrack(callback) {
    const node = parentNode;
    parentNode = undefined;
    const result = callback();
    parentNode = node;
    return result;
}
function batch(callback) {
    if (nodeQueue) return callback();
    nodeQueue = Queue;
    const result = callback();
    queueMicrotask(flush);
    return result;
}
function flush() {
    if (nodeQueue === undefined) return;
    for (const node of nodeQueue){
        nodeQueue.delete(node);
        updateNode(node, false);
    }
    nodeQueue = undefined;
}
function updateNode(node, complete) {
    cleanNode(node, complete);
    if (node.callback === undefined) return;
    const previousNode = parentNode;
    parentNode = node;
    try {
        node.value = node.callback(node.value);
    } catch (error) {
        handleError(error);
    } finally{
        parentNode = previousNode;
    }
}
function cleanNodeSources(node) {
    let source, sourceSlot, sourceNode, nodeSlot;
    while(node.sources.length){
        source = node.sources.pop();
        sourceSlot = node.sourceSlots.pop();
        if (source.nodes?.length) {
            sourceNode = source.nodes.pop();
            nodeSlot = source.nodeSlots.pop();
            if (sourceSlot < source.nodes.length) {
                source.nodes[sourceSlot] = sourceNode;
                source.nodeSlots[sourceSlot] = nodeSlot;
                sourceNode.sourceSlots[nodeSlot] = sourceSlot;
            }
        }
    }
}
function cleanChildNodes(node, complete) {
    const hasCallback = node.callback !== undefined;
    let childNode;
    while(node.children.length){
        childNode = node.children.pop();
        cleanNode(childNode, complete || hasCallback && childNode.callback !== undefined);
    }
}
function cleanNode(node, complete) {
    if (node.sources?.length) cleanNodeSources(node);
    if (node.children?.length) cleanChildNodes(node, complete);
    if (node.cleanups?.length) cleanup(node);
    node.injections = undefined;
    if (complete) disposeNode(node);
}
function cleanup(node) {
    while(node.cleanups?.length){
        node.cleanups.pop()();
    }
}
function disposeNode(node) {
    node.value = undefined;
    node.parentNode = undefined;
    node.children = undefined;
    node.cleanups = undefined;
    node.callback = undefined;
    node.sources = undefined;
    node.sourceSlots = undefined;
}
let parentAttrs;
let parentFgt;
let parentElt;
function attributesRef() {
    if (parentElt === undefined) return undefined;
    if (parentAttrs === undefined) parentAttrs = {};
    return parentAttrs;
}
function elementRef() {
    return parentElt;
}
function addElement(tagName, callback) {
    const elt = document.createElement(tagName);
    if (callback) modify(elt, callback);
    insert(elt);
}
function render(rootElt, callback) {
    return scoped((cleanup)=>{
        const previousElt = parentElt;
        parentElt = rootElt;
        callback();
        parentElt = previousElt;
        return cleanup;
    });
}
function view(callback) {
    if (parentElt === undefined) return callback();
    const anchor = parentElt.appendChild(new Text());
    effect((current)=>{
        const next = parentFgt = [];
        callback();
        union(anchor, current, next);
        parentFgt = undefined;
        return next.length > 0 ? next : undefined;
    });
}
function component(callback) {
    return (...args)=>scoped(()=>callback(...args));
}
function union(anchor, current, next) {
    const elt = anchor.parentNode;
    if (current === undefined) {
        for (const node of next){
            elt.insertBefore(node, anchor);
        }
        return;
    }
    const currentLength = current.length;
    const nextLength = next.length;
    let currentNode, i, j;
    outerLoop: for(i = 0; i < nextLength; i++){
        currentNode = current[i];
        for(j = 0; j < currentLength; j++){
            if (current[j] === undefined) continue;
            else if (current[j].nodeType === 3 && next[i].nodeType === 3) {
                if (current[j].data !== next[i].data) current[j].data = next[i].data;
                next[i] = current[j];
            } else if (current[j].isEqualNode(next[i])) next[i] = current[j];
            if (next[i] === current[j]) {
                current[j] = undefined;
                if (i === j) continue outerLoop;
                break;
            }
        }
        elt.insertBefore(next[i], currentNode?.nextSibling || null);
    }
    while(current.length)current.pop()?.remove();
}
function qualifiedName(name) {
    return name.replace(/([A-Z])/g, (match)=>"-" + match[0]).toLowerCase();
}
function eventName(name) {
    return name.startsWith("on:") ? name.slice(3) : name.slice(2).toLowerCase();
}
function objectAttribute(elt, field, object) {
    for(const subField in object){
        const value = object[subField];
        if (typeof value === "function") {
            effect((subCurr)=>{
                const subNext = value();
                if (subNext !== subCurr) elt[field][subField] = subNext || null;
                return subNext;
            });
        } else {
            elt[field][subField] = value || null;
        }
    }
}
function dynamicAttribute(elt, field, value) {
    effect((current)=>{
        const next = value();
        if (next !== current) attribute(elt, field, next);
        return next;
    });
}
function attribute(elt, field, value) {
    if (typeof value === "function" && !field.startsWith("on")) {
        dynamicAttribute(elt, field, value);
    } else if (typeof value === "object") {
        objectAttribute(elt, field, value);
    } else if (field === "textContent") {
        if (elt.firstChild?.nodeType === 3) elt.firstChild.data = String(value);
        else elt.prepend(String(value));
    } else if (field in elt) {
        elt[field] = value;
    } else if (field.startsWith("on")) {
        elt.addEventListener(eventName(field), value);
    } else if (value != null) {
        elt.setAttributeNS(null, qualifiedName(field), String(value));
    } else {
        elt.removeAttributeNS(null, qualifiedName(field));
    }
}
function insert(node) {
    if (parentElt === undefined) parentFgt?.push(node);
    else parentElt?.appendChild(node);
}
function modify(elt, callback) {
    const previousElt = parentElt;
    const previousAttrs = parentAttrs;
    parentElt = elt;
    parentAttrs = callback.length ? {} : undefined;
    callback(parentAttrs);
    parentElt = undefined;
    if (parentAttrs) {
        for(const field in parentAttrs){
            attribute(elt, field, parentAttrs[field]);
        }
    }
    parentElt = previousElt;
    parentAttrs = previousAttrs;
}
const globalSources = await getGlobalSources();
const localSources = signal(getLocalSources());
const sources = scoped(()=>{
    const sources = ()=>[
            ...globalSources,
            ...localSources()
        ];
    effect((init)=>{
        const sources = localSources();
        if (init === true) return false;
        localStorage.setItem("sources", JSON.stringify(sources));
    }, true);
    return sources;
});
function getLocalSources() {
    const initSources = localStorage.getItem("sources") || "[]";
    try {
        return JSON.parse(initSources);
    } catch  {
        return [];
    }
}
async function getGlobalSources() {
    try {
        return await (await fetch("./sources.json")).json();
    } catch  {
        return [];
    }
}
function getSources() {
    return sources();
}
function find(url) {
    return sources().find((source)=>source.url === url);
}
function first() {
    return sources()[0];
}
function useBooru(config) {
    const posts = signal([]);
    effect(async ()=>{
        const { page =1 , limit =40 , url , tags  } = config();
        const items = [];
        const source = find(url)?.url || url;
        if (source) {
            const api = new URL(source);
            const params = new URLSearchParams();
            params.set("page", page.toString());
            params.set("limit", limit.toString());
            if (tags?.length) params.set("tags", tags.join(" "));
            api.search = params.toString();
            const response = await fetch(api);
            if (response.ok) {
                const json = await response.json();
                for (const post of (Array.isArray(json) ? json : json.post) || []){
                    if (post.id === undefined) {
                        continue;
                    }
                    if (post.file_url === undefined) {
                        continue;
                    }
                    if (post.preview_url === undefined && post.preview_file_url === undefined) {
                        continue;
                    }
                    items.push(normalizePost(post));
                }
            }
        }
        posts(items);
    });
    return posts;
}
function normalizePost(post) {
    const item = {
        id: post.id,
        fileUrl: post.file_url,
        previewUrl: post.preview_url || post.preview_file_url,
        tags: []
    };
    if (post.tags || post.tag_string) {
        item.tags = (post.tags || post.tag_string).split(" ").filter((value)=>value);
    }
    return item;
}
function useTitle(title) {
    const previousTitle = document.title;
    effect(()=>document.title = title());
    onDestroy(()=>document.title = previousTitle);
}
const getHash = ()=>{
    let hash = location.hash;
    if (hash.startsWith("#")) hash = hash.slice(1);
    return hash;
};
const getParams = ()=>{
    const params = new URLSearchParams(getHash());
    return {
        url: params.has("url") ? params.get("url") : first()?.url,
        page: params.has("page") ? ~~params.get("page") : 1,
        limit: params.has("limit") ? ~~params.get("limit") : 40,
        search: params.has("search") ? params.get("search") : "",
        tags: params.has("tags") ? params.get("tags").split(",").filter((tag)=>tag) : []
    };
};
const __default = scoped(()=>{
    const init = getParams();
    const url = signal(init.url);
    const limit = signal(init.limit);
    const loaded = signal(0);
    const size = signal(Infinity);
    const search = signal(init.search);
    const highlighted = signal([]);
    const tags = signal(init.tags);
    const page = signal(init.page);
    const select = signal();
    const posts = useBooru(()=>{
        return {
            url: url(),
            limit: limit(),
            page: page(),
            tags: tags()
        };
    });
    const postTags = ()=>{
        const tags = [];
        for (const post of posts()){
            for (const tag of post.tags){
                if (tags.includes(tag) === false) tags.push(tag);
            }
        }
        return tags.sort((a, b)=>{
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
        });
    };
    const addTag = (tag)=>!hasTag(tag) && tags([
            ...tags(),
            tag
        ]);
    const delTag = (tag)=>tags(tags().filter(($)=>$ !== tag));
    const toggleTag = (tag)=>hasTag(tag) ? delTag(tag) : addTag(tag);
    const hasTag = (tag)=>tags().includes(tag);
    const pageResetTrigger = ()=>(url(), tags(), undefined);
    const onPopState = ()=>{
        const params = getParams();
        url(params.url);
        page(params.page);
        limit(params.limit);
        search(params.search);
        tags(params.tags);
    };
    effect(on(search, (current)=>{
        if (current !== search()) {
            const tags = search().split(" ").filter((value)=>value);
            for (const tag of tags)addTag(tag);
            page(1);
        }
        return search();
    }), init.search);
    useTitle(()=>{
        let title = `ブラウザ：${page()}`;
        if (tags().length) {
            title += ` 「${tags().join("、 ")}」`;
        }
        return title;
    });
    effect(on(posts, ()=>{
        size(posts().length);
        loaded(0);
    }));
    effect(on(pageResetTrigger, (current)=>{
        const next = `${url()}${tags().join()}`;
        if (current !== next) page(1);
        return next;
    }), `${url()}${tags().join()}`);
    effect((params)=>{
        if (page() > 1) params.set("page", page().toString());
        else params.delete("page");
        params.set("limit", limit().toString());
        if (tags().length) params.set("tags", tags().join(","));
        else params.delete("tags");
        if (search().length) params.set("search", search());
        else params.delete("search");
        params.set("url", url());
        location.hash = params.toString();
        return params;
    }, new URLSearchParams(getHash()));
    addEventListener("popstate", onPopState);
    return {
        highlighted,
        tags,
        posts,
        postTags,
        page,
        select,
        addTag,
        delTag,
        hasTag,
        toggleTag,
        search,
        loaded,
        size,
        limit,
        url
    };
});
function useWiki(query) {
    const cache = new Map();
    const wiki = signal();
    effect(async ()=>{
        const title = query();
        if (title) {
            if (cache.has(title)) return wiki(cache.get(title));
            const response = await fetch(`/api/wiki/${title}`);
            if (response.status === 200) {
                cache.set(title, await response.text());
                return wiki(cache.get(title));
            }
        }
        wiki(undefined);
    });
    return wiki;
}
function usePervert() {
    const init = localStorage.getItem("is:pervert") === "true";
    const codes = "imapervert".split("");
    const pervert = signal(init);
    let index = 0;
    const onKeyUp = ({ key  })=>{
        if (index === codes.length - 1) {
            localStorage.setItem("is:pervert", "true");
            pervert(true);
            return;
        }
        if (key != null && codes[index] != null && key.toLowerCase() === codes[index].toLowerCase()) {
            index++;
        } else {
            index = 0;
            pervert(false);
        }
    };
    effect(()=>{
        onCleanup(()=>removeEventListener("keyup", onKeyUp));
        if (pervert()) return;
        addEventListener("keyup", onKeyUp);
    });
    return pervert;
}
function uploadFile(accept, readAs) {
    return new Promise((res)=>{
        const input = document.createElement("input");
        input.type = "file";
        input.accept = accept;
        input.onchange = (ev)=>{
            const files = ev.currentTarget.files;
            if (files === null) return;
            const reader = new FileReader();
            reader.onload = ()=>{
                res(reader.result);
            };
            reader[readAs](files[0]);
        };
        input.click();
    });
}
function download(name, type, data) {
    const encoded = `${type};charset=utf-8,${encodeURIComponent(data)}`;
    const a = document.createElement("a");
    a.href = "data:" + encoded;
    a.download = name;
    a.click();
}
const Navigation = component(()=>{
    const { postTags , tags  } = __default;
    const query = signal("");
    const wiki = useWiki(query);
    const sourceEdit = signal(false);
    addElement("nav", ()=>{
        const ref = elementRef();
        view(()=>{
            addElement("div", (attr)=>{
                addElement("div", (attr)=>{
                    attr.class = "flex bg-accent-2 align-items-center sticky-top";
                    addElement("h2", (attr)=>{
                        attr.class = "flex-1 padding-10";
                        attr.textContent = "source editor";
                    });
                    addElement("button", (attr)=>{
                        attr.class = "icon download-json";
                        attr.title = "download sources";
                        attr.onClick = ()=>{
                            download(`sources-${Date.now()}.json`, "application/json", JSON.stringify(localSources(), null, 2));
                        };
                    });
                    addElement("button", (attr)=>{
                        attr.class = "icon close";
                        attr.title = "close editor";
                        attr.onClick = ()=>sourceEdit(false);
                    });
                });
                attr.class = "source-editor z-index-1";
                attr.open = sourceEdit;
                for (const source of localSources()){
                    SourceEdit(source);
                }
                AddSource();
            });
        });
        addElement("div", (attr)=>{
            attr.class = "nav-top";
            Inputs(sourceEdit);
            Paging();
            view(()=>{
                for (const tag of tags()){
                    addElement("div", ()=>tagAttributes(tag, query, wiki));
                }
            });
        });
        addElement("div", (attr)=>{
            attr.class = "tags";
            view(()=>{
                onMount(()=>ref.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    }));
                const selTags = tags();
                for (const tag of postTags().filter((tag)=>!selTags.includes(tag))){
                    addElement("div", ()=>tagAttributes(tag, query, wiki));
                }
            });
        });
    });
});
function tagAttributes(tag, query, wiki) {
    const { toggleTag , tags , highlighted  } = __default;
    const attr = attributesRef();
    let mouseId;
    attr.textContent = tag;
    attr.class = "tag";
    attr.title = ()=>tag === query() ? wiki() || tag : tag;
    attr.onClick = ()=>toggleTag(tag);
    attr.onMouseOver = ()=>{
        clearTimeout(mouseId);
        mouseId = setTimeout(()=>query(tag), 500);
    };
    attr.onMouseOut = ()=>{
        clearTimeout(mouseId);
        query(undefined);
    };
    attr.state = ()=>{
        if (tags().includes(tag)) return "active";
        else if (highlighted().includes(tag)) return "highlight";
    };
}
const Inputs = component((sourceEdit)=>{
    const { search , url  } = __default;
    const pervert = usePervert();
    addElement("div", (attr)=>{
        attr.class = "flex align-items-center";
        view(()=>{
            if (pervert()) {
                addElement("button", (attr)=>{
                    attr.title = "choose image source";
                    attr.name = "source";
                    attr.type = "button";
                    attr.class = "icon source z-index-1";
                    addElement("div", (attr)=>{
                        attr.class = "sources";
                        addElement("div", (attr)=>{
                            attr.title = "open source editor";
                            attr.textContent = "source editor";
                            attr.onClick = ()=>sourceEdit(!sourceEdit());
                        });
                        for (const source of getSources()){
                            addElement("div", (attr)=>{
                                attr.active = ()=>source.url === url();
                                attr.textContent = source.name;
                                attr.onClick = ()=>url(source.url);
                            });
                        }
                    });
                });
            }
        });
        addElement("button", (attr)=>{
            attr.title = "browse source";
            attr.name = "sourcecode";
            attr.type = "button";
            attr.class = "icon sourcecode";
            attr.onClick = ()=>{
                open("https://github.com/mini-jail/burauza", "_blank");
            };
        });
        addElement("input", (attr)=>{
            attr.class = "flex-1";
            attr.name = "search";
            attr.placeholder = "search...";
            attr.value = search;
            attr.type = "text";
            let id;
            attr.onInput = (ev)=>{
                ev.stopImmediatePropagation();
                ev.stopPropagation();
                const value = ev.currentTarget.value;
                clearTimeout(id);
                id = setTimeout(()=>search(value), 1000);
            };
        });
    });
});
const Paging = component(()=>{
    const { page  } = __default;
    addElement("div", (attr)=>{
        attr.class = "nav-paging";
        addElement("button", (attr)=>{
            attr.class = "previous";
            attr.textContent = ()=>String(page() - 1);
            attr.disabled = ()=>page() <= 1;
            attr.onClick = ()=>page(page() - 1);
        });
        addElement("button", (attr)=>{
            attr.class = "current";
            attr.disabled = true;
            attr.textContent = ()=>String(page());
        });
        addElement("button", (attr)=>{
            attr.class = "next";
            attr.textContent = ()=>String(page() + 1);
            attr.onClick = ()=>page(page() + 1);
        });
    });
});
const AddSource = component(()=>{
    const name = signal("");
    const url = signal("");
    addElement("div", (attr)=>{
        attr.class = "flex padding-10";
        addElement("div", (attr)=>{
            attr.class = "flex align-items-baseline";
            addElement("label", (attr)=>attr.textContent = "name:");
            addElement("input", (attr)=>{
                attr.class = "flex-1";
                attr.name = "name";
                attr.value = name;
                attr.onInput = (ev)=>name(ev.currentTarget.value);
                attr.placeholder = "*Booru";
            });
        });
        addElement("div", (attr)=>{
            attr.class = "flex align-items-baseline";
            addElement("label", (attr)=>attr.textContent = "url:");
            addElement("input", (attr)=>{
                attr.class = "flex-1";
                attr.name = "url";
                attr.value = url;
                attr.onInput = (ev)=>url(ev.currentTarget.value);
                attr.placeholder = "https://...";
            });
        });
        addElement("button", (attr)=>{
            attr.class = "icon plus";
            attr.title = "add source";
            attr.disabled = ()=>!name() || !url();
            attr.onClick = ()=>{
                if (!name() || !url()) return;
                localSources(localSources().concat({
                    name: name(),
                    url: url()
                }));
                url("");
                name("");
            };
        });
        addElement("button", (attr)=>{
            attr.class = "icon import";
            attr.title = "import source";
            attr.onClick = async ()=>{
                const data = await uploadFile(".json", "readAsText");
                const json = JSON.parse(data);
                const importedSources = [];
                if (Array.isArray(json)) {
                    for (const source of json){
                        if (source.name && source.url) {
                            importedSources.push(source);
                        }
                    }
                }
                localSources(localSources().concat(importedSources));
            };
        });
    });
});
const SourceEdit = component((source)=>{
    addElement("div", (attr)=>{
        attr.class = "flex justify-content-center padding-10";
        addElement("div", (attr)=>{
            attr.class = "flex align-items-baseline";
            addElement("label", (attr)=>attr.textContent = "name:");
            addElement("input", (attr)=>{
                attr.class = "flex-1";
                attr.name = "name";
                attr.value = source.name;
                attr.placeholder = "*Booru";
                attr.onInput = (ev)=>source.name = ev.currentTarget.value;
            });
        });
        addElement("div", (attr)=>{
            attr.class = "flex align-items-baseline";
            addElement("label", (attr)=>attr.textContent = "url:");
            addElement("input", (attr)=>{
                attr.class = "flex-1";
                attr.value = source.url;
                attr.placeholder = "https://...";
                attr.onInput = (ev)=>source.url = ev.currentTarget.value;
            });
        });
        addElement("button", (attr)=>{
            attr.class = "icon check";
            attr.title = "save source";
            attr.onClick = ()=>{
                const newSource = {
                    url: source.url,
                    name: source.name
                };
                localSources(localSources().filter(($)=>$ !== source).concat(newSource));
            };
        });
        addElement("button", (attr)=>{
            attr.class = "icon delete";
            attr.title = "delete source";
            attr.onClick = ()=>{
                localSources(localSources().filter(($)=>$ !== source));
            };
        });
    });
});
const PreviewTopBar = component(()=>{
    const { select  } = __default;
    addElement("div", (attr)=>{
        attr.class = "top z-index-1";
        addElement("div", (attr)=>{
            attr.class = "title";
            attr.textContent = ()=>String(select()?.fileUrl);
        });
        addElement("button", (attr)=>{
            attr.type = "button";
            attr.class = "icon close";
            attr.onClick = ()=>select(undefined);
        });
    });
});
const Tags = component(()=>{
    const { select , hasTag , addTag  } = __default;
    addElement("div", (attr)=>{
        attr.class = "preview-tags";
        view(()=>{
            const post = select();
            if (post == undefined) return;
            for (const tag of post.tags){
                addElement("span", (attr)=>{
                    attr.class = "tag";
                    attr.textContent = tag;
                    attr.state = ()=>hasTag(tag) ? "active" : "";
                    attr.onClick = ()=>addTag(tag);
                });
            }
        });
    });
});
const Preview = component(()=>{
    const { select , size , loaded  } = __default;
    const source = signal("");
    const ready = signal(false);
    effect(()=>{
        const item = select();
        source(item?.fileUrl);
        onCleanup(()=>ready(false));
    });
    addElement("div", (attr)=>{
        attr.class = "loading";
        attr.ready = ()=>size() <= loaded();
        attr.textContent = ()=>{
            const value = String(Math.floor(loaded() / size() * 100));
            if (value === "NaN") return "Loading... 0%";
            return "Loading... " + value + "%";
        };
    });
    addElement("div", (attr)=>{
        attr.class = "preview";
        attr.active = ()=>ready() && select() !== undefined;
        PreviewTopBar();
        addElement("div", (attr)=>{
            attr.class = "preview-content";
            view(()=>{
                if (source() === undefined) return;
                if (select() === undefined) return;
                addElement("img", (attr)=>{
                    attr.src = source();
                    attr.alt = select().fileUrl;
                    attr.onLoad = ()=>ready(true);
                    attr.onError = ()=>source(select().previewUrl);
                    attr.onClick = ()=>open(select().fileUrl, "_blank");
                });
            });
            Tags();
        });
    });
});
const Posts = component(()=>{
    const { posts , highlighted , select , loaded , size  } = __default;
    addElement("main", (attr)=>{
        const ref = elementRef();
        attr.ready = ()=>size() <= loaded();
        view(()=>{
            onMount(()=>ref.scrollTo({
                    top: 0,
                    behavior: "smooth"
                }));
            for (const post of posts()){
                addElement("article", ()=>{
                    addElement("img", (attr)=>{
                        attr.src = post.previewUrl;
                        attr.alt = attr.src;
                        attr.onClick = ()=>select(post);
                        attr.onLoad = ()=>loaded(loaded() + 1);
                        attr.onError = attr.onLoad;
                        attr.onMouseOver = ()=>highlighted(post.tags);
                        attr.onMouseOut = ()=>highlighted([]);
                    });
                });
            }
        });
    });
});
const App = component(()=>{
    Navigation();
    Posts();
    Preview();
});
render(document.body, ()=>{
    App();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9taW5pLWphaWwvc2lnbmFsL21haW4vbW9kLnRzIiwiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL21pbmktamFpbC9kb20vbWFpbi9tb2QudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9jb21wb25lbnRzL3VzZS1ib29ydS50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvdXNlLXRpdGxlLnRzIiwiZmlsZTovLy9tbnQvMEE1NTRDNkUzQzY4RTY2QS9Qcm9qZWt0ZS9naXRodWIvYnVyYXV6YS9zcmMvY29udGV4dC50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvdXNlLXdpa2kudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9jb21wb25lbnRzL3VzZS1wZXJ2ZXJ0LnRzIiwiZmlsZTovLy9tbnQvMEE1NTRDNkUzQzY4RTY2QS9Qcm9qZWt0ZS9naXRodWIvYnVyYXV6YS9zcmMvY29tcG9uZW50cy91cGxvYWQudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9jb21wb25lbnRzL2Rvd25sb2FkLnRzIiwiZmlsZTovLy9tbnQvMEE1NTRDNkUzQzY4RTY2QS9Qcm9qZWt0ZS9naXRodWIvYnVyYXV6YS9zcmMvY29tcG9uZW50cy9uYXZpZ2F0aW9uLnRzIiwiZmlsZTovLy9tbnQvMEE1NTRDNkUzQzY4RTY2QS9Qcm9qZWt0ZS9naXRodWIvYnVyYXV6YS9zcmMvY29tcG9uZW50cy9wcmV2aWV3LnRzIiwiZmlsZTovLy9tbnQvMEE1NTRDNkUzQzY4RTY2QS9Qcm9qZWt0ZS9naXRodWIvYnVyYXV6YS9zcmMvY29tcG9uZW50cy9wb3N0cy50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2FwcC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgdHlwZSBDbGVhbnVwID0gKCkgPT4gdm9pZFxuZXhwb3J0IHR5cGUgU2lnbmFsPFQgPSBhbnk+ID0ge1xuICAoKTogVFxuICAodmFsdWU6IFQgfCB1bmRlZmluZWQpOiB2b2lkXG4gIChjYWxsYmFjazogKGN1cnJlbnQ6IFQgfCB1bmRlZmluZWQpID0+IFQpOiB2b2lkXG59XG5leHBvcnQgdHlwZSBTb3VyY2U8VCA9IGFueT4gPSB7XG4gIHZhbHVlOiBUIHwgdW5kZWZpbmVkIHwgbnVsbFxuICBub2RlczogTm9kZVtdIHwgdW5kZWZpbmVkXG4gIG5vZGVTbG90czogbnVtYmVyW10gfCB1bmRlZmluZWRcbn1cbmV4cG9ydCB0eXBlIE5vZGU8VCA9IGFueT4gPSB7XG4gIHZhbHVlOiBUIHwgdW5kZWZpbmVkIHwgbnVsbFxuICBwYXJlbnROb2RlOiBOb2RlIHwgdW5kZWZpbmVkXG4gIGNoaWxkcmVuOiBOb2RlW10gfCB1bmRlZmluZWRcbiAgaW5qZWN0aW9uczogeyBbaWQ6IHN5bWJvbF06IGFueSB9IHwgdW5kZWZpbmVkXG4gIGNsZWFudXBzOiBDbGVhbnVwW10gfCB1bmRlZmluZWRcbiAgY2FsbGJhY2s6ICgoY3VycmVudDogVCkgPT4gVCkgfCB1bmRlZmluZWRcbiAgc291cmNlczogU291cmNlW10gfCB1bmRlZmluZWRcbiAgc291cmNlU2xvdHM6IG51bWJlcltdIHwgdW5kZWZpbmVkXG59XG5leHBvcnQgdHlwZSBSZWY8VCA9IGFueT4gPSB7XG4gIHZhbHVlOiBUXG59XG5leHBvcnQgdHlwZSBQcm92aWRlcjxUPiA9IDxSPih2YWx1ZTogVCwgY2FsbGJhY2s6ICgpID0+IFIpID0+IFJcbmV4cG9ydCB0eXBlIEluamVjdGlvbjxUPiA9IHtcbiAgcmVhZG9ubHkgaWQ6IHN5bWJvbFxuICByZWFkb25seSBkZWZhdWx0VmFsdWU6IFQgfCB1bmRlZmluZWRcbn1cblxuY29uc3QgRXJyb3IgPSBTeW1ib2woKVxuY29uc3QgUXVldWUgPSBuZXcgU2V0PE5vZGU+KClcbmxldCBub2RlUXVldWU6IFNldDxOb2RlPiB8IHVuZGVmaW5lZFxubGV0IHBhcmVudE5vZGU6IE5vZGUgfCB1bmRlZmluZWRcblxuZXhwb3J0IGZ1bmN0aW9uIHNjb3BlZDxUID0gYW55PihjYWxsYmFjazogKGNsZWFudXA6IENsZWFudXApID0+IFQpOiBUIHwgdm9pZCB7XG4gIGNvbnN0IG5vZGUgPSBjcmVhdGVOb2RlPFQ+KClcbiAgcGFyZW50Tm9kZSA9IG5vZGVcbiAgdHJ5IHtcbiAgICByZXR1cm4gYmF0Y2goKCkgPT4ge1xuICAgICAgbGV0IF9jbGVhbnVwOiBDbGVhbnVwIHwgbmV2ZXIgPSA8bmV2ZXI+IHVuZGVmaW5lZFxuICAgICAgaWYgKGNhbGxiYWNrLmxlbmd0aCkge1xuICAgICAgICBfY2xlYW51cCA9IGNsZWFuTm9kZS5iaW5kKHVuZGVmaW5lZCwgbm9kZSwgdHJ1ZSlcbiAgICAgIH1cbiAgICAgIHJldHVybiBjYWxsYmFjayhfY2xlYW51cClcbiAgICB9KSFcbiAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICBoYW5kbGVFcnJvcihlcnJvcilcbiAgfSBmaW5hbGx5IHtcbiAgICBwYXJlbnROb2RlID0gbm9kZS5wYXJlbnROb2RlXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG5vZGVSZWYoKTogTm9kZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBwYXJlbnROb2RlXG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU5vZGU8VCA9IGFueT4oKTogTm9kZTxUIHwgdW5kZWZpbmVkPlxuZnVuY3Rpb24gY3JlYXRlTm9kZTxUID0gYW55Pihpbml0aWFsVmFsdWU6IFQpOiBOb2RlPFQ+XG5mdW5jdGlvbiBjcmVhdGVOb2RlPFQgPSBhbnk+KFxuICBpbml0aWFsVmFsdWU6IFQsXG4gIGNhbGxiYWNrOiAoY3VycmVudDogVCB8IHVuZGVmaW5lZCkgPT4gVCxcbik6IE5vZGU8VD5cbmZ1bmN0aW9uIGNyZWF0ZU5vZGUoXG4gIGluaXRpYWxWYWx1ZT86IGFueSxcbiAgY2FsbGJhY2s/OiAoY3VycmVudDogYW55IHwgdW5kZWZpbmVkKSA9PiBhbnksXG4pOiBOb2RlPGFueSB8IHVuZGVmaW5lZD4ge1xuICBjb25zdCBub2RlOiBOb2RlID0ge1xuICAgIHZhbHVlOiBpbml0aWFsVmFsdWUsXG4gICAgcGFyZW50Tm9kZSxcbiAgICBjaGlsZHJlbjogdW5kZWZpbmVkLFxuICAgIGluamVjdGlvbnM6IHVuZGVmaW5lZCxcbiAgICBjbGVhbnVwczogdW5kZWZpbmVkLFxuICAgIGNhbGxiYWNrLFxuICAgIHNvdXJjZXM6IHVuZGVmaW5lZCxcbiAgICBzb3VyY2VTbG90czogdW5kZWZpbmVkLFxuICB9XG4gIGlmIChwYXJlbnROb2RlKSB7XG4gICAgaWYgKHBhcmVudE5vZGUuY2hpbGRyZW4gPT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFyZW50Tm9kZS5jaGlsZHJlbiA9IFtub2RlXVxuICAgIH0gZWxzZSB7XG4gICAgICBwYXJlbnROb2RlLmNoaWxkcmVuLnB1c2gobm9kZSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG5vZGVcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uTW91bnQoY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgZWZmZWN0KCgpID0+IHVudHJhY2soY2FsbGJhY2spKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gb25EZXN0cm95KGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gIG9uQ2xlYW51cCgoKSA9PiB1bnRyYWNrKGNhbGxiYWNrKSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uPFQ+KFxuICBkZXBlbmRlbmN5OiAoKSA9PiB1bmtub3duLFxuICBjYWxsYmFjazogKGN1cnJlbnQ6IFQgfCB1bmRlZmluZWQpID0+IFQsXG4pOiAoY3VycmVudDogVCB8IHVuZGVmaW5lZCkgPT4gVCB7XG4gIHJldHVybiAoKGN1cnJlbnQpID0+IHtcbiAgICBkZXBlbmRlbmN5KClcbiAgICByZXR1cm4gdW50cmFjaygoKSA9PiBjYWxsYmFjayhjdXJyZW50KSlcbiAgfSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdDxUPihjYWxsYmFjazogKGN1cnJlbnQ6IFQgfCB1bmRlZmluZWQpID0+IFQpOiB2b2lkXG5leHBvcnQgZnVuY3Rpb24gZWZmZWN0PFQsIEk+KFxuICBjYWxsYmFjazogKGN1cnJlbnQ6IEkgfCBUKSA9PiBULFxuICBpbml0aWFsVmFsdWU6IEksXG4pOiB2b2lkXG5leHBvcnQgZnVuY3Rpb24gZWZmZWN0KFxuICBjYWxsYmFjazogKGN1cnJlbnQ6IHVua25vd24pID0+IHVua25vd24sXG4gIGluaXRpYWxWYWx1ZT86IHVua25vd24sXG4pOiB2b2lkIHtcbiAgaWYgKHBhcmVudE5vZGUpIHtcbiAgICBjb25zdCBub2RlID0gY3JlYXRlTm9kZShpbml0aWFsVmFsdWUsIGNhbGxiYWNrKVxuICAgIGlmIChub2RlUXVldWUpIG5vZGVRdWV1ZS5hZGQobm9kZSlcbiAgICBlbHNlIHF1ZXVlTWljcm90YXNrKCgpID0+IHVwZGF0ZU5vZGUobm9kZSwgZmFsc2UpKVxuICB9IGVsc2Uge1xuICAgIHF1ZXVlTWljcm90YXNrKCgpID0+IGNhbGxiYWNrKGluaXRpYWxWYWx1ZSkpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGltbWVkaWF0ZUVmZmVjdDxUPihcbiAgY2FsbGJhY2s6IChjdXJyZW50OiBUIHwgdW5kZWZpbmVkKSA9PiBULFxuKTogdm9pZFxuZXhwb3J0IGZ1bmN0aW9uIGltbWVkaWF0ZUVmZmVjdDxULCBJPihcbiAgY2FsbGJhY2s6IChjdXJyZW50OiBJIHwgVCkgPT4gVCxcbiAgaW5pdGlhbFZhbHVlOiBJLFxuKTogdm9pZFxuZXhwb3J0IGZ1bmN0aW9uIGltbWVkaWF0ZUVmZmVjdChcbiAgY2FsbGJhY2s6IChjdXJyZW50OiB1bmtub3duKSA9PiB1bmtub3duLFxuICBpbml0aWFsVmFsdWU/OiB1bmtub3duLFxuKTogdm9pZCB7XG4gIGlmIChwYXJlbnROb2RlKSB1cGRhdGVOb2RlKGNyZWF0ZU5vZGUoaW5pdGlhbFZhbHVlLCBjYWxsYmFjayksIGZhbHNlKVxuICBlbHNlIGNhbGxiYWNrKGluaXRpYWxWYWx1ZSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVkPFQ+KGNhbGxiYWNrOiAoY3VycmVudDogVCB8IHVuZGVmaW5lZCkgPT4gVCk6ICgpID0+IFRcbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlZDxULCBJPihcbiAgY2FsbGJhY2s6IChjdXJyZW50OiBJIHwgVCkgPT4gVCxcbiAgaW5pdGlhbFZhbHVlOiBJLFxuKTogKCkgPT4gVFxuZXhwb3J0IGZ1bmN0aW9uIGNvbXB1dGVkKFxuICBjYWxsYmFjazogKGN1cnJlbnQ6IHVua25vd24gfCB1bmRlZmluZWQpID0+IHVua25vd24sXG4gIGluaXRpYWxWYWx1ZT86IHVua25vd24sXG4pOiAoY3VycmVudDogdW5rbm93bikgPT4gdW5rbm93biB7XG4gIGNvbnN0IHNvdXJjZSA9IGNyZWF0ZVNvdXJjZShpbml0aWFsVmFsdWUpXG4gIGVmZmVjdCgoKSA9PiBzZXRTb3VyY2VWYWx1ZShzb3VyY2UsIGNhbGxiYWNrKHNvdXJjZS52YWx1ZSEpKSlcbiAgcmV0dXJuIGdldFNvdXJjZVZhbHVlLmJpbmQodW5kZWZpbmVkLCBzb3VyY2UpXG59XG5cbmZ1bmN0aW9uIGxvb2t1cChub2RlOiBOb2RlIHwgdW5kZWZpbmVkLCBpZDogc3ltYm9sKTogYW55IHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIG5vZGVcbiAgICA/IG5vZGUuaW5qZWN0aW9ucyAmJiBpZCBpbiBub2RlLmluamVjdGlvbnNcbiAgICAgID8gbm9kZS5pbmplY3Rpb25zW2lkXVxuICAgICAgOiBsb29rdXAobm9kZS5wYXJlbnROb2RlLCBpZClcbiAgICA6IHVuZGVmaW5lZFxufVxuXG5mdW5jdGlvbiBjcmVhdGVTb3VyY2U8VCA9IGFueT4oKTogU291cmNlPFQgfCB1bmRlZmluZWQ+XG5mdW5jdGlvbiBjcmVhdGVTb3VyY2U8VCA9IGFueT4oaW5pdGlhbFZhbHVlOiBUKTogU291cmNlPFQ+XG5mdW5jdGlvbiBjcmVhdGVTb3VyY2UoaW5pdGlhbFZhbHVlPzogYW55KTogU291cmNlPGFueSB8IHVuZGVmaW5lZD4ge1xuICByZXR1cm4geyB2YWx1ZTogaW5pdGlhbFZhbHVlLCBub2RlczogdW5kZWZpbmVkLCBub2RlU2xvdHM6IHVuZGVmaW5lZCB9XG59XG5cbmZ1bmN0aW9uIGdldFNvdXJjZVZhbHVlPFQgPSBhbnk+KHNvdXJjZTogU291cmNlPFQ+KTogVCB7XG4gIGlmIChwYXJlbnROb2RlICYmIHBhcmVudE5vZGUuY2FsbGJhY2spIHtcbiAgICBjb25zdCBzb3VyY2VTbG90ID0gc291cmNlLm5vZGVzPy5sZW5ndGggfHwgMCxcbiAgICAgIG5vZGVTbG90ID0gcGFyZW50Tm9kZS5zb3VyY2VzPy5sZW5ndGggfHwgMFxuICAgIGlmIChwYXJlbnROb2RlLnNvdXJjZXMgPT09IHVuZGVmaW5lZCkge1xuICAgICAgcGFyZW50Tm9kZS5zb3VyY2VzID0gW3NvdXJjZV1cbiAgICAgIHBhcmVudE5vZGUuc291cmNlU2xvdHMgPSBbc291cmNlU2xvdF1cbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50Tm9kZS5zb3VyY2VzLnB1c2goc291cmNlKVxuICAgICAgcGFyZW50Tm9kZS5zb3VyY2VTbG90cyEucHVzaChzb3VyY2VTbG90KVxuICAgIH1cbiAgICBpZiAoc291cmNlLm5vZGVzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHNvdXJjZS5ub2RlcyA9IFtwYXJlbnROb2RlXVxuICAgICAgc291cmNlLm5vZGVTbG90cyA9IFtub2RlU2xvdF1cbiAgICB9IGVsc2Uge1xuICAgICAgc291cmNlLm5vZGVzIS5wdXNoKHBhcmVudE5vZGUpXG4gICAgICBzb3VyY2Uubm9kZVNsb3RzIS5wdXNoKG5vZGVTbG90KVxuICAgIH1cbiAgfVxuICByZXR1cm4gc291cmNlLnZhbHVlIVxufVxuXG5mdW5jdGlvbiBzZXRTb3VyY2VWYWx1ZTxUID0gYW55Pihzb3VyY2U6IFNvdXJjZTxUPiwgdmFsdWU6IGFueSk6IHZvaWQge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIpIHZhbHVlID0gdmFsdWUoc291cmNlLnZhbHVlKVxuICBzb3VyY2UudmFsdWUgPSB2YWx1ZVxuICBpZiAoc291cmNlLm5vZGVzPy5sZW5ndGgpIHtcbiAgICBiYXRjaCgoKSA9PiB7XG4gICAgICBmb3IgKGNvbnN0IG5vZGUgb2Ygc291cmNlLm5vZGVzISkge1xuICAgICAgICBub2RlUXVldWUhLmFkZChub2RlKVxuICAgICAgfVxuICAgIH0pXG4gIH1cbn1cblxuZnVuY3Rpb24gc291cmNlVmFsdWU8VCA9IGFueT4oc291cmNlOiBTb3VyY2U8VD4sIHZhbHVlPzogYW55KTogVCB8IHZvaWQge1xuICByZXR1cm4gYXJndW1lbnRzLmxlbmd0aCA9PT0gMVxuICAgID8gZ2V0U291cmNlVmFsdWUoc291cmNlKVxuICAgIDogc2V0U291cmNlVmFsdWUoc291cmNlLCB2YWx1ZSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25hbDxUPigpOiBTaWduYWw8VCB8IHVuZGVmaW5lZD5cbmV4cG9ydCBmdW5jdGlvbiBzaWduYWw8VD4oaW5pdGlhbFZhbHVlOiBUKTogU2lnbmFsPFQ+XG5leHBvcnQgZnVuY3Rpb24gc2lnbmFsKGluaXRpYWxWYWx1ZT86IGFueSk6IFNpZ25hbDxhbnkgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3Qgc291cmNlID0gY3JlYXRlU291cmNlKGluaXRpYWxWYWx1ZSlcbiAgcmV0dXJuIHNvdXJjZVZhbHVlLmJpbmQodW5kZWZpbmVkLCBzb3VyY2UpIGFzIFNpZ25hbDxhbnkgfCB1bmRlZmluZWQ+XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWY8VD4oKTogUmVmPFQgfCB1bmRlZmluZWQ+XG5leHBvcnQgZnVuY3Rpb24gcmVmPFQ+KGluaXRpYWxWYWx1ZTogVCk6IFJlZjxUPlxuZXhwb3J0IGZ1bmN0aW9uIHJlZihpbml0aWFsVmFsdWU/OiBhbnkpOiBSZWY8YW55IHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IHNvdXJjZSA9IGNyZWF0ZVNvdXJjZShpbml0aWFsVmFsdWUpXG4gIHJldHVybiB7XG4gICAgZ2V0IHZhbHVlKCkge1xuICAgICAgcmV0dXJuIGdldFNvdXJjZVZhbHVlKHNvdXJjZSlcbiAgICB9LFxuICAgIHNldCB2YWx1ZShuZXh0VmFsdWUpIHtcbiAgICAgIHNldFNvdXJjZVZhbHVlKHNvdXJjZSwgbmV4dFZhbHVlKVxuICAgIH0sXG4gIH1cbn1cblxuZnVuY3Rpb24gaGFuZGxlRXJyb3IoZXJyb3I6IGFueSk6IHZvaWQge1xuICBjb25zdCBlcnJvckNhbGxiYWNrczogKChlcnI6IGFueSkgPT4gdm9pZClbXSA9IGxvb2t1cChwYXJlbnROb2RlLCBFcnJvcilcbiAgaWYgKCFlcnJvckNhbGxiYWNrcykgcmV0dXJuIHJlcG9ydEVycm9yKGVycm9yKVxuICBmb3IgKGNvbnN0IGNhbGxiYWNrIG9mIGVycm9yQ2FsbGJhY2tzKSB7XG4gICAgY2FsbGJhY2soZXJyb3IpXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uRXJyb3I8VCA9IGFueT4oY2FsbGJhY2s6IChlcnJvcjogVCkgPT4gdm9pZCk6IHZvaWQge1xuICBpZiAocGFyZW50Tm9kZSA9PT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgaWYgKHBhcmVudE5vZGUuaW5qZWN0aW9ucyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcGFyZW50Tm9kZS5pbmplY3Rpb25zID0geyBbRXJyb3JdOiBbY2FsbGJhY2tdIH1cbiAgfSBlbHNlIHtcbiAgICBwYXJlbnROb2RlLmluamVjdGlvbnNbRXJyb3JdLnB1c2goY2FsbGJhY2spXG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uQ2xlYW51cChjYWxsYmFjazogKCkgPT4gdm9pZCk6IHZvaWQge1xuICBpZiAocGFyZW50Tm9kZSA9PT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgZWxzZSBpZiAoIXBhcmVudE5vZGUuY2xlYW51cHMpIHBhcmVudE5vZGUuY2xlYW51cHMgPSBbY2FsbGJhY2tdXG4gIGVsc2UgcGFyZW50Tm9kZS5jbGVhbnVwcy5wdXNoKGNhbGxiYWNrKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdW50cmFjazxUPihjYWxsYmFjazogKCkgPT4gVCk6IFQge1xuICBjb25zdCBub2RlID0gcGFyZW50Tm9kZVxuICBwYXJlbnROb2RlID0gdW5kZWZpbmVkXG4gIGNvbnN0IHJlc3VsdCA9IGNhbGxiYWNrKClcbiAgcGFyZW50Tm9kZSA9IG5vZGVcbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBiYXRjaDxUPihjYWxsYmFjazogKCkgPT4gVCk6IFQge1xuICBpZiAobm9kZVF1ZXVlKSByZXR1cm4gY2FsbGJhY2soKVxuICBub2RlUXVldWUgPSBRdWV1ZVxuICBjb25zdCByZXN1bHQgPSBjYWxsYmFjaygpXG4gIHF1ZXVlTWljcm90YXNrKGZsdXNoKVxuICByZXR1cm4gcmVzdWx0XG59XG5cbmZ1bmN0aW9uIGZsdXNoKCk6IHZvaWQge1xuICBpZiAobm9kZVF1ZXVlID09PSB1bmRlZmluZWQpIHJldHVyblxuICBmb3IgKGNvbnN0IG5vZGUgb2Ygbm9kZVF1ZXVlKSB7XG4gICAgbm9kZVF1ZXVlLmRlbGV0ZShub2RlKVxuICAgIHVwZGF0ZU5vZGUobm9kZSwgZmFsc2UpXG4gIH1cbiAgbm9kZVF1ZXVlID0gdW5kZWZpbmVkXG59XG5cbmZ1bmN0aW9uIHVwZGF0ZU5vZGUobm9kZTogTm9kZSwgY29tcGxldGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgY2xlYW5Ob2RlKG5vZGUsIGNvbXBsZXRlKVxuICBpZiAobm9kZS5jYWxsYmFjayA9PT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgY29uc3QgcHJldmlvdXNOb2RlID0gcGFyZW50Tm9kZVxuICBwYXJlbnROb2RlID0gbm9kZVxuICB0cnkge1xuICAgIG5vZGUudmFsdWUgPSBub2RlLmNhbGxiYWNrKG5vZGUudmFsdWUpXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyb3IpXG4gIH0gZmluYWxseSB7XG4gICAgcGFyZW50Tm9kZSA9IHByZXZpb3VzTm9kZVxuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFuTm9kZVNvdXJjZXMobm9kZTogTm9kZSk6IHZvaWQge1xuICBsZXQgc291cmNlOiBTb3VyY2UsIHNvdXJjZVNsb3Q6IG51bWJlciwgc291cmNlTm9kZTogTm9kZSwgbm9kZVNsb3Q6IG51bWJlclxuICB3aGlsZSAobm9kZS5zb3VyY2VzIS5sZW5ndGgpIHtcbiAgICBzb3VyY2UgPSBub2RlLnNvdXJjZXMhLnBvcCgpIVxuICAgIHNvdXJjZVNsb3QgPSBub2RlLnNvdXJjZVNsb3RzIS5wb3AoKSFcbiAgICBpZiAoc291cmNlLm5vZGVzPy5sZW5ndGgpIHtcbiAgICAgIHNvdXJjZU5vZGUgPSBzb3VyY2Uubm9kZXMucG9wKCkhXG4gICAgICBub2RlU2xvdCA9IHNvdXJjZS5ub2RlU2xvdHMhLnBvcCgpIVxuICAgICAgaWYgKHNvdXJjZVNsb3QgPCBzb3VyY2Uubm9kZXMubGVuZ3RoKSB7XG4gICAgICAgIHNvdXJjZS5ub2Rlc1tzb3VyY2VTbG90XSA9IHNvdXJjZU5vZGVcbiAgICAgICAgc291cmNlLm5vZGVTbG90cyFbc291cmNlU2xvdF0gPSBub2RlU2xvdFxuICAgICAgICBzb3VyY2VOb2RlLnNvdXJjZVNsb3RzIVtub2RlU2xvdF0gPSBzb3VyY2VTbG90XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFuQ2hpbGROb2Rlcyhub2RlOiBOb2RlLCBjb21wbGV0ZTogYm9vbGVhbik6IHZvaWQge1xuICBjb25zdCBoYXNDYWxsYmFjayA9IG5vZGUuY2FsbGJhY2sgIT09IHVuZGVmaW5lZFxuICBsZXQgY2hpbGROb2RlOiBOb2RlXG4gIHdoaWxlIChub2RlLmNoaWxkcmVuIS5sZW5ndGgpIHtcbiAgICBjaGlsZE5vZGUgPSBub2RlLmNoaWxkcmVuIS5wb3AoKSFcbiAgICBjbGVhbk5vZGUoXG4gICAgICBjaGlsZE5vZGUsXG4gICAgICBjb21wbGV0ZSB8fCAoaGFzQ2FsbGJhY2sgJiYgY2hpbGROb2RlLmNhbGxiYWNrICE9PSB1bmRlZmluZWQpLFxuICAgIClcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGVhbk5vZGUobm9kZTogTm9kZSwgY29tcGxldGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgaWYgKG5vZGUuc291cmNlcz8ubGVuZ3RoKSBjbGVhbk5vZGVTb3VyY2VzKG5vZGUpXG4gIGlmIChub2RlLmNoaWxkcmVuPy5sZW5ndGgpIGNsZWFuQ2hpbGROb2Rlcyhub2RlLCBjb21wbGV0ZSlcbiAgaWYgKG5vZGUuY2xlYW51cHM/Lmxlbmd0aCkgY2xlYW51cChub2RlKVxuICBub2RlLmluamVjdGlvbnMgPSB1bmRlZmluZWRcbiAgaWYgKGNvbXBsZXRlKSBkaXNwb3NlTm9kZShub2RlKVxufVxuXG5mdW5jdGlvbiBjbGVhbnVwKG5vZGU6IE5vZGUpOiB2b2lkIHtcbiAgd2hpbGUgKG5vZGUuY2xlYW51cHM/Lmxlbmd0aCkge1xuICAgIG5vZGUuY2xlYW51cHMucG9wKCkhKClcbiAgfVxufVxuXG5mdW5jdGlvbiBkaXNwb3NlTm9kZShub2RlOiBOb2RlKTogdm9pZCB7XG4gIG5vZGUudmFsdWUgPSB1bmRlZmluZWRcbiAgbm9kZS5wYXJlbnROb2RlID0gdW5kZWZpbmVkXG4gIG5vZGUuY2hpbGRyZW4gPSB1bmRlZmluZWRcbiAgbm9kZS5jbGVhbnVwcyA9IHVuZGVmaW5lZFxuICBub2RlLmNhbGxiYWNrID0gdW5kZWZpbmVkXG4gIG5vZGUuc291cmNlcyA9IHVuZGVmaW5lZFxuICBub2RlLnNvdXJjZVNsb3RzID0gdW5kZWZpbmVkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3Rpb248VD4oKTogSW5qZWN0aW9uPFQgfCB1bmRlZmluZWQ+XG5leHBvcnQgZnVuY3Rpb24gaW5qZWN0aW9uPFQ+KGRlZmF1bHRWYWx1ZTogVCk6IEluamVjdGlvbjxUPlxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdGlvbihkZWZhdWx0VmFsdWU/OiBhbnkpOiBJbmplY3Rpb248YW55IHwgdW5kZWZpbmVkPiB7XG4gIHJldHVybiB7IGlkOiBTeW1ib2woKSwgZGVmYXVsdFZhbHVlIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb3ZpZGU8VCwgUj4oXG4gIGluamVjdGlvbjogSW5qZWN0aW9uPFQ+LFxuICB2YWx1ZTogVCxcbiAgY2FsbGJhY2s6ICgpID0+IFIsXG4pOiBSIHtcbiAgcmV0dXJuIHNjb3BlZCgoKSA9PiB7XG4gICAgcGFyZW50Tm9kZSEuaW5qZWN0aW9ucyA9IHsgW2luamVjdGlvbi5pZF06IHZhbHVlIH1cbiAgICByZXR1cm4gY2FsbGJhY2soKVxuICB9KSFcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHByb3ZpZGVyPFQ+KGluamVjdGlvbjogSW5qZWN0aW9uPFQ+KTogUHJvdmlkZXI8VD4ge1xuICByZXR1cm4gKHZhbHVlLCBjYWxsYmFjaykgPT4gcHJvdmlkZShpbmplY3Rpb24sIHZhbHVlLCBjYWxsYmFjaylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdDxUPihpbmplY3Rpb246IEluamVjdGlvbjxUPik6IFQge1xuICByZXR1cm4gbG9va3VwKHBhcmVudE5vZGUsIGluamVjdGlvbi5pZCkgfHwgaW5qZWN0aW9uLmRlZmF1bHRWYWx1ZVxufVxuIiwiaW1wb3J0IHtcbiAgQ2xlYW51cCxcbiAgZWZmZWN0LFxuICBzY29wZWQsXG59IGZyb20gXCJodHRwczovL3Jhdy5naXRodWJ1c2VyY29udGVudC5jb20vbWluaS1qYWlsL3NpZ25hbC9tYWluL21vZC50c1wiXG5cbmxldCBwYXJlbnRBdHRyczogT2JqZWN0IHwgdW5kZWZpbmVkXG5sZXQgcGFyZW50Rmd0OiBET01Ob2RlW10gfCB1bmRlZmluZWRcbmxldCBwYXJlbnRFbHQ6IERPTUVsZW1lbnQgfCB1bmRlZmluZWRcblxuZXhwb3J0IGZ1bmN0aW9uIGF0dHJpYnV0ZXNSZWYoKTpcbiAgfCBFbGVtZW50QXR0cmlidXRlcyAmIEV2ZW50QXR0cmlidXRlczxIVE1MRWxlbWVudD5cbiAgfCB1bmRlZmluZWRcbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGVzUmVmPFQgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVBdHRyaWJ1dGVNYXA+KCk6XG4gIHwgSFRNTEVsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwW1RdXG4gIHwgdW5kZWZpbmVkXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlc1JlZjxUIGV4dGVuZHMga2V5b2YgU1ZHRWxlbWVudFRhZ05hbWVBdHRyaWJ1dGVNYXA+KCk6XG4gIHwgU1ZHRWxlbWVudFRhZ05hbWVBdHRyaWJ1dGVNYXBbVF1cbiAgfCB1bmRlZmluZWRcbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGVzUmVmKCk6IE9iamVjdCB8IHVuZGVmaW5lZCB7XG4gIGlmIChwYXJlbnRFbHQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIHVuZGVmaW5lZFxuICBpZiAocGFyZW50QXR0cnMgPT09IHVuZGVmaW5lZCkgcGFyZW50QXR0cnMgPSB7fVxuICByZXR1cm4gcGFyZW50QXR0cnNcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRSZWYoKTogSFRNTEVsZW1lbnQgfCB1bmRlZmluZWRcbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50UmVmKCk6IFNWR0VsZW1lbnQgfCB1bmRlZmluZWRcbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50UmVmPFQgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVNYXA+KCk6XG4gIHwgSFRNTEVsZW1lbnRUYWdOYW1lTWFwW1RdXG4gIHwgdW5kZWZpbmVkXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudFJlZjxUIGV4dGVuZHMga2V5b2YgU1ZHRWxlbWVudFRhZ05hbWVNYXA+KCk6XG4gIHwgU1ZHRWxlbWVudFRhZ05hbWVNYXBbVF1cbiAgfCB1bmRlZmluZWRcbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50UmVmKCk6IEhUTUxFbGVtZW50IHwgU1ZHRWxlbWVudCB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBwYXJlbnRFbHRcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZEVsZW1lbnQ8VCBleHRlbmRzIGtleW9mIEhUTUxFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcD4oXG4gIHRhZ05hbWU6IFQsXG4gIGNhbGxiYWNrPzogKGF0dHJpYnV0ZXM6IEhUTUxFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcFtUXSkgPT4gdm9pZCxcbik6IHZvaWQge1xuICBjb25zdCBlbHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KDxzdHJpbmc+IHRhZ05hbWUpXG4gIGlmIChjYWxsYmFjaykgbW9kaWZ5KDxET01FbGVtZW50PiBlbHQsIGNhbGxiYWNrKVxuICBpbnNlcnQoZWx0KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gYWRkRWxlbWVudE5TPFQgZXh0ZW5kcyBrZXlvZiBTVkdFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcD4oXG4gIHRhZ05hbWU6IFQsXG4gIGNhbGxiYWNrPzogKGF0dHJpYnV0ZXM6IFNWR0VsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwW1RdKSA9PiB2b2lkLFxuKTogdm9pZCB7XG4gIGNvbnN0IGVsdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnROUyhcbiAgICBcImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIsXG4gICAgPHN0cmluZz4gdGFnTmFtZSxcbiAgKVxuICBpZiAoY2FsbGJhY2spIG1vZGlmeSg8RE9NRWxlbWVudD4gZWx0LCBjYWxsYmFjaylcbiAgaW5zZXJ0KGVsdClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZFRleHQodmFsdWU6IGFueSk6IHZvaWQge1xuICBpbnNlcnQoZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoU3RyaW5nKHZhbHVlKSkpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZW5kZXIocm9vdEVsdDogSFRNTEVsZW1lbnQsIGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogQ2xlYW51cCB7XG4gIHJldHVybiBzY29wZWQoKGNsZWFudXApID0+IHtcbiAgICBjb25zdCBwcmV2aW91c0VsdCA9IHBhcmVudEVsdFxuICAgIHBhcmVudEVsdCA9IDxET01FbGVtZW50PiByb290RWx0XG4gICAgY2FsbGJhY2soKVxuICAgIHBhcmVudEVsdCA9IHByZXZpb3VzRWx0XG4gICAgcmV0dXJuIGNsZWFudXBcbiAgfSkhXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB2aWV3KGNhbGxiYWNrOiAoKSA9PiB2b2lkKSB7XG4gIGlmIChwYXJlbnRFbHQgPT09IHVuZGVmaW5lZCkgcmV0dXJuIGNhbGxiYWNrKClcbiAgY29uc3QgYW5jaG9yID0gcGFyZW50RWx0LmFwcGVuZENoaWxkKG5ldyBUZXh0KCkpXG4gIGVmZmVjdDxET01Ob2RlW10gfCB1bmRlZmluZWQ+KChjdXJyZW50KSA9PiB7XG4gICAgY29uc3QgbmV4dDogRE9NTm9kZVtdID0gcGFyZW50Rmd0ID0gW11cbiAgICBjYWxsYmFjaygpXG4gICAgdW5pb24oYW5jaG9yLCBjdXJyZW50LCBuZXh0KVxuICAgIHBhcmVudEZndCA9IHVuZGVmaW5lZFxuICAgIHJldHVybiBuZXh0Lmxlbmd0aCA+IDAgPyBuZXh0IDogdW5kZWZpbmVkXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wb25lbnQ8VCBleHRlbmRzICguLi5hcmdzOiBhbnlbXSkgPT4gYW55PihcbiAgY2FsbGJhY2s6IFQsXG4pOiAoLi4uYXJnczogUGFyYW1ldGVyczxUPikgPT4gUmV0dXJuVHlwZTxUPiB7XG4gIHJldHVybiAoKC4uLmFyZ3MpID0+IHNjb3BlZCgoKSA9PiBjYWxsYmFjayguLi5hcmdzKSkpXG59XG5cbmZ1bmN0aW9uIHVuaW9uKFxuICBhbmNob3I6IERPTU5vZGUsXG4gIGN1cnJlbnQ6IChET01Ob2RlIHwgdW5kZWZpbmVkKVtdIHwgdW5kZWZpbmVkLFxuICBuZXh0OiBET01Ob2RlW10sXG4pOiB2b2lkIHtcbiAgY29uc3QgZWx0ID0gYW5jaG9yLnBhcmVudE5vZGUhXG4gIGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQpIHtcbiAgICBmb3IgKGNvbnN0IG5vZGUgb2YgbmV4dCkge1xuICAgICAgZWx0Lmluc2VydEJlZm9yZShub2RlLCBhbmNob3IpXG4gICAgfVxuICAgIHJldHVyblxuICB9XG4gIGNvbnN0IGN1cnJlbnRMZW5ndGggPSBjdXJyZW50Lmxlbmd0aFxuICBjb25zdCBuZXh0TGVuZ3RoID0gbmV4dC5sZW5ndGhcbiAgbGV0IGN1cnJlbnROb2RlOiBET01Ob2RlIHwgdW5kZWZpbmVkLCBpOiBudW1iZXIsIGo6IG51bWJlclxuICBvdXRlckxvb3A6XG4gIGZvciAoaSA9IDA7IGkgPCBuZXh0TGVuZ3RoOyBpKyspIHtcbiAgICBjdXJyZW50Tm9kZSA9IGN1cnJlbnRbaV1cbiAgICBmb3IgKGogPSAwOyBqIDwgY3VycmVudExlbmd0aDsgaisrKSB7XG4gICAgICBpZiAoY3VycmVudFtqXSA9PT0gdW5kZWZpbmVkKSBjb250aW51ZVxuICAgICAgZWxzZSBpZiAoY3VycmVudFtqXSEubm9kZVR5cGUgPT09IDMgJiYgbmV4dFtpXS5ub2RlVHlwZSA9PT0gMykge1xuICAgICAgICBpZiAoY3VycmVudFtqXSEuZGF0YSAhPT0gbmV4dFtpXS5kYXRhKSBjdXJyZW50W2pdIS5kYXRhID0gbmV4dFtpXS5kYXRhXG4gICAgICAgIG5leHRbaV0gPSBjdXJyZW50W2pdIVxuICAgICAgfSBlbHNlIGlmIChjdXJyZW50W2pdIS5pc0VxdWFsTm9kZShuZXh0W2ldKSkgbmV4dFtpXSA9IGN1cnJlbnRbal0hXG4gICAgICBpZiAobmV4dFtpXSA9PT0gY3VycmVudFtqXSkge1xuICAgICAgICBjdXJyZW50W2pdID0gdW5kZWZpbmVkXG4gICAgICAgIGlmIChpID09PSBqKSBjb250aW51ZSBvdXRlckxvb3BcbiAgICAgICAgYnJlYWtcbiAgICAgIH1cbiAgICB9XG4gICAgZWx0Lmluc2VydEJlZm9yZShuZXh0W2ldLCBjdXJyZW50Tm9kZT8ubmV4dFNpYmxpbmcgfHwgbnVsbClcbiAgfVxuICB3aGlsZSAoY3VycmVudC5sZW5ndGgpIGN1cnJlbnQucG9wKCk/LnJlbW92ZSgpXG59XG5cbmZ1bmN0aW9uIHF1YWxpZmllZE5hbWUobmFtZTogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIG5hbWVcbiAgICAucmVwbGFjZSgvKFtBLVpdKS9nLCAobWF0Y2gpID0+IFwiLVwiICsgbWF0Y2hbMF0pXG4gICAgLnRvTG93ZXJDYXNlKClcbn1cblxuZnVuY3Rpb24gZXZlbnROYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBuYW1lLnN0YXJ0c1dpdGgoXCJvbjpcIikgPyBuYW1lLnNsaWNlKDMpIDogbmFtZS5zbGljZSgyKS50b0xvd2VyQ2FzZSgpXG59XG5cbmZ1bmN0aW9uIG9iamVjdEF0dHJpYnV0ZShlbHQ6IERPTUVsZW1lbnQsIGZpZWxkOiBzdHJpbmcsIG9iamVjdDogYW55KTogdm9pZCB7XG4gIGZvciAoY29uc3Qgc3ViRmllbGQgaW4gb2JqZWN0KSB7XG4gICAgY29uc3QgdmFsdWUgPSBvYmplY3Rbc3ViRmllbGRdXG4gICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICBlZmZlY3Q8YW55Pigoc3ViQ3VycikgPT4ge1xuICAgICAgICBjb25zdCBzdWJOZXh0ID0gdmFsdWUoKVxuICAgICAgICBpZiAoc3ViTmV4dCAhPT0gc3ViQ3VycikgZWx0W2ZpZWxkXVtzdWJGaWVsZF0gPSBzdWJOZXh0IHx8IG51bGxcbiAgICAgICAgcmV0dXJuIHN1Yk5leHRcbiAgICAgIH0pXG4gICAgfSBlbHNlIHtcbiAgICAgIGVsdFtmaWVsZF1bc3ViRmllbGRdID0gdmFsdWUgfHwgbnVsbFxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkeW5hbWljQXR0cmlidXRlKFxuICBlbHQ6IERPTUVsZW1lbnQsXG4gIGZpZWxkOiBzdHJpbmcsXG4gIHZhbHVlOiAoKSA9PiB1bmtub3duLFxuKTogdm9pZCB7XG4gIGVmZmVjdDx1bmtub3duPigoY3VycmVudCkgPT4ge1xuICAgIGNvbnN0IG5leHQgPSB2YWx1ZSgpXG4gICAgaWYgKG5leHQgIT09IGN1cnJlbnQpIGF0dHJpYnV0ZShlbHQsIGZpZWxkLCBuZXh0KVxuICAgIHJldHVybiBuZXh0XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGF0dHJpYnV0ZShlbHQ6IERPTUVsZW1lbnQsIGZpZWxkOiBzdHJpbmcsIHZhbHVlOiB1bmtub3duKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIiAmJiAhZmllbGQuc3RhcnRzV2l0aChcIm9uXCIpKSB7XG4gICAgZHluYW1pY0F0dHJpYnV0ZShlbHQsIGZpZWxkLCB2YWx1ZSBhcyAoKCkgPT4gdW5rbm93bikpXG4gIH0gZWxzZSBpZiAodHlwZW9mIHZhbHVlID09PSBcIm9iamVjdFwiKSB7XG4gICAgb2JqZWN0QXR0cmlidXRlKGVsdCwgZmllbGQsIHZhbHVlKVxuICB9IGVsc2UgaWYgKGZpZWxkID09PSBcInRleHRDb250ZW50XCIpIHtcbiAgICBpZiAoZWx0LmZpcnN0Q2hpbGQ/Lm5vZGVUeXBlID09PSAzKSBlbHQuZmlyc3RDaGlsZC5kYXRhID0gU3RyaW5nKHZhbHVlKVxuICAgIGVsc2UgZWx0LnByZXBlbmQoU3RyaW5nKHZhbHVlKSlcbiAgfSBlbHNlIGlmIChmaWVsZCBpbiBlbHQpIHtcbiAgICBlbHRbZmllbGRdID0gdmFsdWVcbiAgfSBlbHNlIGlmIChmaWVsZC5zdGFydHNXaXRoKFwib25cIikpIHtcbiAgICBlbHQuYWRkRXZlbnRMaXN0ZW5lcihldmVudE5hbWUoZmllbGQpLCA8RXZlbnRMaXN0ZW5lcj4gdmFsdWUpXG4gIH0gZWxzZSBpZiAodmFsdWUgIT0gbnVsbCkge1xuICAgIGVsdC5zZXRBdHRyaWJ1dGVOUyhudWxsLCBxdWFsaWZpZWROYW1lKGZpZWxkKSwgU3RyaW5nKHZhbHVlKSlcbiAgfSBlbHNlIHtcbiAgICBlbHQucmVtb3ZlQXR0cmlidXRlTlMobnVsbCwgcXVhbGlmaWVkTmFtZShmaWVsZCkpXG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0KG5vZGU6IERPTU5vZGUpOiB2b2lkIHtcbiAgaWYgKHBhcmVudEVsdCA9PT0gdW5kZWZpbmVkKSBwYXJlbnRGZ3Q/LnB1c2gobm9kZSlcbiAgZWxzZSBwYXJlbnRFbHQ/LmFwcGVuZENoaWxkKG5vZGUpXG59XG5cbmZ1bmN0aW9uIG1vZGlmeShlbHQ6IERPTUVsZW1lbnQsIGNhbGxiYWNrOiAoYXR0cmlidXRlczogYW55KSA9PiB2b2lkKTogdm9pZCB7XG4gIGNvbnN0IHByZXZpb3VzRWx0ID0gcGFyZW50RWx0XG4gIGNvbnN0IHByZXZpb3VzQXR0cnMgPSBwYXJlbnRBdHRyc1xuICBwYXJlbnRFbHQgPSBlbHRcbiAgcGFyZW50QXR0cnMgPSBjYWxsYmFjay5sZW5ndGggPyB7fSA6IHVuZGVmaW5lZFxuICBjYWxsYmFjayhwYXJlbnRBdHRycylcbiAgcGFyZW50RWx0ID0gdW5kZWZpbmVkXG4gIGlmIChwYXJlbnRBdHRycykge1xuICAgIGZvciAoY29uc3QgZmllbGQgaW4gcGFyZW50QXR0cnMpIHtcbiAgICAgIGF0dHJpYnV0ZShlbHQsIGZpZWxkLCBwYXJlbnRBdHRyc1tmaWVsZF0pXG4gICAgfVxuICB9XG4gIHBhcmVudEVsdCA9IHByZXZpb3VzRWx0XG4gIHBhcmVudEF0dHJzID0gcHJldmlvdXNBdHRyc1xufVxuXG50eXBlIE9iamVjdCA9IHsgW2ZpZWxkOiBzdHJpbmddOiBhbnkgfVxudHlwZSBBY2Nlc3NhYmxlPFQ+ID0gVCB8ICgoKSA9PiBUKVxudHlwZSBBY2Nlc3NhYmxlT2JqZWN0PFQ+ID0geyBbRmllbGQgaW4ga2V5b2YgVF06IEFjY2Vzc2FibGU8VFtGaWVsZF0+IH1cbnR5cGUgRE9NRWxlbWVudCA9IChIVE1MRWxlbWVudCB8IFNWR0VsZW1lbnQpICYgeyBmaXJzdENoaWxkOiBET01Ob2RlIH0gJiBPYmplY3RcbnR5cGUgRE9NTm9kZSA9IChOb2RlIHwgRE9NRWxlbWVudCkgJiBPYmplY3RcbnR5cGUgQW55U3RyaW5nID0gb2JqZWN0ICYgc3RyaW5nXG50eXBlIEJvb2xlYW5MaWtlID0gYm9vbGVhbiB8IFwiZmFsc2VcIiB8IFwidHJ1ZVwiXG50eXBlIE51bWJlckxpa2UgPSBudW1iZXIgfCBzdHJpbmdcbnR5cGUgSFRNTEF0dHJpYnV0ZVJlZmVycmVyUG9saWN5ID1cbiAgfCBcIm5vLXJlZmVycmVyXCJcbiAgfCBcIm5vLXJlZmVycmVyLXdoZW4tZG93bmdyYWRlXCJcbiAgfCBcIm9yaWdpblwiXG4gIHwgXCJvcmlnaW4td2hlbi1jcm9zcy1vcmlnaW5cIlxuICB8IFwic2FtZS1vcmlnaW5cIlxuICB8IFwic3RyaWN0LW9yaWdpblwiXG4gIHwgXCJzdHJpY3Qtb3JpZ2luLXdoZW4tY3Jvc3Mtb3JpZ2luXCJcbiAgfCBcInVuc2FmZS11cmxcIlxuICB8IEFueVN0cmluZ1xudHlwZSBIVE1MSW5wdXRUeXBlQXR0cmlidXRlID1cbiAgfCBcImJ1dHRvblwiXG4gIHwgXCJjaGVja2JveFwiXG4gIHwgXCJjb2xvclwiXG4gIHwgXCJkYXRlXCJcbiAgfCBcImRhdGV0aW1lLWxvY2FsXCJcbiAgfCBcImVtYWlsXCJcbiAgfCBcImZpbGVcIlxuICB8IFwiaGlkZGVuXCJcbiAgfCBcImltYWdlXCJcbiAgfCBcIm1vbnRoXCJcbiAgfCBcIm51bWJlclwiXG4gIHwgXCJwYXNzd29yZFwiXG4gIHwgXCJyYWRpb1wiXG4gIHwgXCJyYW5nZVwiXG4gIHwgXCJyZXNldFwiXG4gIHwgXCJzZWFyY2hcIlxuICB8IFwic3VibWl0XCJcbiAgfCBcInRlbFwiXG4gIHwgXCJ0ZXh0XCJcbiAgfCBcInRpbWVcIlxuICB8IFwidXJsXCJcbiAgfCBcIndlZWtcIlxuICB8IEFueVN0cmluZ1xudHlwZSBBcmlhUm9sZSA9XG4gIHwgXCJhbGVydFwiXG4gIHwgXCJhbGVydGRpYWxvZ1wiXG4gIHwgXCJhcHBsaWNhdGlvblwiXG4gIHwgXCJhcnRpY2xlXCJcbiAgfCBcImJhbm5lclwiXG4gIHwgXCJidXR0b25cIlxuICB8IFwiY2VsbFwiXG4gIHwgXCJjaGVja2JveFwiXG4gIHwgXCJjb2x1bW5oZWFkZXJcIlxuICB8IFwiY29tYm9ib3hcIlxuICB8IFwiY29tcGxlbWVudGFyeVwiXG4gIHwgXCJjb250ZW50aW5mb1wiXG4gIHwgXCJkZWZpbml0aW9uXCJcbiAgfCBcImRpYWxvZ1wiXG4gIHwgXCJkaXJlY3RvcnlcIlxuICB8IFwiZG9jdW1lbnRcIlxuICB8IFwiZmVlZFwiXG4gIHwgXCJmaWd1cmVcIlxuICB8IFwiZm9ybVwiXG4gIHwgXCJncmlkXCJcbiAgfCBcImdyaWRjZWxsXCJcbiAgfCBcImdyb3VwXCJcbiAgfCBcImhlYWRpbmdcIlxuICB8IFwiaW1nXCJcbiAgfCBcImxpbmtcIlxuICB8IFwibGlzdFwiXG4gIHwgXCJsaXN0Ym94XCJcbiAgfCBcImxpc3RpdGVtXCJcbiAgfCBcImxvZ1wiXG4gIHwgXCJtYWluXCJcbiAgfCBcIm1hcnF1ZWVcIlxuICB8IFwibWF0aFwiXG4gIHwgXCJtZW51XCJcbiAgfCBcIm1lbnViYXJcIlxuICB8IFwibWVudWl0ZW1cIlxuICB8IFwibWVudWl0ZW1jaGVja2JveFwiXG4gIHwgXCJtZW51aXRlbXJhZGlvXCJcbiAgfCBcIm5hdmlnYXRpb25cIlxuICB8IFwibm9uZVwiXG4gIHwgXCJub3RlXCJcbiAgfCBcIm9wdGlvblwiXG4gIHwgXCJwcmVzZW50YXRpb25cIlxuICB8IFwicHJvZ3Jlc3NiYXJcIlxuICB8IFwicmFkaW9cIlxuICB8IFwicmFkaW9ncm91cFwiXG4gIHwgXCJyZWdpb25cIlxuICB8IFwicm93XCJcbiAgfCBcInJvd2dyb3VwXCJcbiAgfCBcInJvd2hlYWRlclwiXG4gIHwgXCJzY3JvbGxiYXJcIlxuICB8IFwic2VhcmNoXCJcbiAgfCBcInNlYXJjaGJveFwiXG4gIHwgXCJzZXBhcmF0b3JcIlxuICB8IFwic2xpZGVyXCJcbiAgfCBcInNwaW5idXR0b25cIlxuICB8IFwic3RhdHVzXCJcbiAgfCBcInN3aXRjaFwiXG4gIHwgXCJ0YWJcIlxuICB8IFwidGFibGVcIlxuICB8IFwidGFibGlzdFwiXG4gIHwgXCJ0YWJwYW5lbFwiXG4gIHwgXCJ0ZXJtXCJcbiAgfCBcInRleHRib3hcIlxuICB8IFwidGltZXJcIlxuICB8IFwidG9vbGJhclwiXG4gIHwgXCJ0b29sdGlwXCJcbiAgfCBcInRyZWVcIlxuICB8IFwidHJlZWdyaWRcIlxuICB8IFwidHJlZWl0ZW1cIlxuICB8IEFueVN0cmluZ1xuZGVjbGFyZSBnbG9iYWwge1xuICBpbnRlcmZhY2UgQ3VzdG9tSFRNTEVsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwIHt9XG59XG5pbnRlcmZhY2UgSFRNTEVsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwXG4gIGV4dGVuZHMgQ3VzdG9tSFRNTEVsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwIHtcbiAgYTogSFRNTEFuY2hvckF0dHJpYnV0ZXNcbiAgYWJicjogSFRNTEFiYnJldmlhdGlvbkF0dHJpYnV0ZXNcbiAgYWRkcmVzczogSFRNTEFkZHJlc3NBdHRyaWJ1dGVzXG4gIGFyZWE6IEhUTUxBcmVhQXR0cmlidXRlc1xuICBhcnRpY2xlOiBIVE1MQXJ0aWNsZUF0dHJpYnV0ZXNcbiAgYXNpZGU6IEhUTUxBc2lkZUF0dHJpYnV0ZXNcbiAgYXVkaW86IEhUTUxBdWRpb0F0dHJpYnV0ZXNcbiAgYjogSFRNTEF0dGVudGlvbkF0dHJpYnV0ZXNcbiAgYmFzZTogSFRNTEJhc2VBdHRyaWJ1dGVzXG4gIGJkaTogSFRNTEJpZGlyZWN0aW9uYWxJc29sYXRlQXR0cmlidXRlc1xuICBiZG86IEhUTUxCaWRpcmVjdGlvbmFsVGV4dE92ZXJyaWRlQXR0cmlidXRlc1xuICBibG9ja3F1b3RlOiBIVE1MUXVvdGVBdHRyaWJ1dGVzXG4gIGJvZHk6IEhUTUxCb2R5QXR0cmlidXRlc1xuICBicjogSFRNTEJSQXR0cmlidXRlc1xuICBidXR0b246IEhUTUxCdXR0b25BdHRyaWJ1dGVzXG4gIGNhbnZhczogSFRNTENhbnZhc0F0dHJpYnV0ZXNcbiAgY2FwdGlvbjogSFRNTFRhYmxlQ2FwdGlvbkF0dHJpYnV0ZXNcbiAgY2l0ZTogSFRNTENpdGF0aW9uQXR0cmlidXRlc1xuICBjb2RlOiBIVE1MSW5saW5lQ29kZUF0dHJpYnV0ZXNcbiAgY29sOiBIVE1MVGFibGVDb2xBdHRyaWJ1dGVzXG4gIGNvbGdyb3VwOiBIVE1MVGFibGVDb2xBdHRyaWJ1dGVzXG4gIGRhdGE6IEhUTUxEYXRhQXR0cmlidXRlc1xuICBkYXRhbGlzdDogSFRNTERhdGFMaXN0QXR0cmlidXRlc1xuICBkZDogSFRNTERlc2NyaXB0aW9uRGV0YWlsc0F0dHJpYnV0ZXNcbiAgZGVsOiBIVE1MTW9kQXR0cmlidXRlc1xuICBkZXRhaWxzOiBIVE1MRGV0YWlsc0F0dHJpYnV0ZXNcbiAgZGZuOiBIVE1MRGVmaW5pdGlvbkF0dHJpYnV0ZXNcbiAgZGlhbG9nOiBIVE1MRGlhbG9nQXR0cmlidXRlc1xuICBkaXI6IEhUTUxEaXJlY3RvcnlBdHRyaWJ1dGVzXG4gIGRpdjogSFRNTERpdkF0dHJpYnV0ZXNcbiAgZGw6IEhUTUxETEF0dHJpYnV0ZXNcbiAgZHQ6IEhUTUxEZXNjcmlwdGlvblRlcm1BdHRyaWJ1dGVzXG4gIGVtOiBIVE1MRW1waGFzaXNBdHRyaWJ1dGVzXG4gIGVtYmVkOiBIVE1MRW1iZWRBdHRyaWJ1dGVzXG4gIGZpZWxkc2V0OiBIVE1MRmllbGRzZXRBdHRyaWJ1dGVzXG4gIGZpZ2NhcHRpb246IEhUTUxGaWd1cmVDYXB0aW9uQXR0cmlidXRlc1xuICBmaWd1cmU6IEhUTUxGaWd1cmVBdHRyaWJ1dGVzXG4gIGZvbnQ6IEhUTUxGb250QXR0cmlidXRlc1xuICBmb290ZXI6IEhUTUxGb290ZXJBdHRyaWJ1dGVzXG4gIGZvcm06IEhUTUxGb3JtQXR0cmlidXRlc1xuICBmcmFtZTogSFRNTEZyYW1lQXR0cmlidXRlc1xuICBmcmFtZXNldDogSFRNTEZyYW1lU2V0QXR0cmlidXRlc1xuICBoMTogSFRNTEhlYWRpbmdBdHRyaWJ1dGVzXG4gIGgyOiBIVE1MSGVhZGluZ0F0dHJpYnV0ZXNcbiAgaDM6IEhUTUxIZWFkaW5nQXR0cmlidXRlc1xuICBoNDogSFRNTEhlYWRpbmdBdHRyaWJ1dGVzXG4gIGg1OiBIVE1MSGVhZGluZ0F0dHJpYnV0ZXNcbiAgaDY6IEhUTUxIZWFkaW5nQXR0cmlidXRlc1xuICBoZWFkOiBIVE1MSGVhZEF0dHJpYnV0ZXNcbiAgaGVhZGVyOiBIVE1MSGVhZGVyQXR0cmlidXRlc1xuICBoZ3JvdXA6IEhUTUxIZWFkaW5nR3JvdXBBdHRyaWJ1dGVzXG4gIGhyOiBIVE1MSFJBdHRyaWJ1dGVzXG4gIGh0bWw6IEhUTUxIdG1sQXR0cmlidXRlc1xuICBpOiBIVE1MSWRpb21hdGljVGV4dEF0dHJpYnV0ZXNcbiAgaWZyYW1lOiBIVE1MSUZyYW1lQXR0cmlidXRlc1xuICBpbWc6IEhUTUxJbWFnZUF0dHJpYnV0ZXNcbiAgaW5wdXQ6IEhUTUxJbnB1dEF0dHJpYnV0ZXNcbiAgaW5zOiBIVE1MTW9kQXR0cmlidXRlc1xuICBrYmQ6IEhUTUxLZXlib2FyZElucHV0QXR0cmlidXRlc1xuICBsYWJlbDogSFRNTExhYmVsQXR0cmlidXRlc1xuICBsZWdlbmQ6IEhUTUxMZWdlbmRBdHRyaWJ1dGVzXG4gIGxpOiBIVE1MTElBdHRyaWJ1dGVzXG4gIGxpbms6IEhUTUxMaW5rQXR0cmlidXRlc1xuICBtYWluOiBIVE1MTWFpbkF0dHJpYnV0ZXNcbiAgbWFwOiBIVE1MTWFwQXR0cmlidXRlc1xuICBtYXJrOiBIVE1MTWFya1RleHRBdHRyaWJ1dGVzXG4gIG1hcnF1ZWU6IEhUTUxNYXJxdWVlQXR0cmlidXRlc1xuICBtZW51OiBIVE1MTWVudUF0dHJpYnV0ZXNcbiAgbWV0YTogSFRNTE1ldGFBdHRyaWJ1dGVzXG4gIG1ldGVyOiBIVE1MTWV0ZXJBdHRyaWJ1dGVzXG4gIG5hdjogSFRNTE5hdmlnYXRpb25TZWN0aW9uQXR0cmlidXRlc1xuICBub3NjcmlwdDogSFRNTE5vU2NyaXB0QXR0cmlidXRlc1xuICBvYmplY3Q6IEhUTUxPYmplY3RBdHRyaWJ1dGVzXG4gIG9sOiBIVE1MT0xpc3RBdHRyaWJ1dGVzXG4gIG9wdGdyb3VwOiBIVE1MT3B0R3JvdXBBdHRyaWJ1dGVzXG4gIG9wdGlvbjogSFRNTE9wdGlvbkF0dHJpYnV0ZXNcbiAgb3V0cHV0OiBIVE1MT3V0cHV0QXR0cmlidXRlc1xuICBwOiBIVE1MUGFyYWdyYXBoQXR0cmlidXRlc1xuICBwYXJhbTogSFRNTFBhcmFtQXR0cmlidXRlc1xuICBwaWN0dXJlOiBIVE1MUGljdHVyZUF0dHJpYnV0ZXNcbiAgcHJlOiBIVE1MUHJlQXR0cmlidXRlc1xuICBwcm9ncmVzczogSFRNTFByb2dyZXNzQXR0cmlidXRlc1xuICBxOiBIVE1MUXVvdGVBdHRyaWJ1dGVzXG4gIHJwOiBIVE1MUnVieUZhbGxiYWNrUGFyZW50aGVzaXNBdHRyaWJ1dGVzXG4gIHJ0OiBIVE1MUnVieVRleHRBdHRyaWJ1dGVzXG4gIHJ1Ynk6IEhUTUxSdWJ5QW5ub3RhdGlvbkF0dHJpYnV0ZXNcbiAgczogSFRNTFN0cmlrZVRocm91Z2hBdHRyaWJ1dGVzXG4gIHNhbXA6IEhUTUxTYW1wbGVPdXRwdXRBdHRyaWJ1dGVzXG4gIHNjcmlwdDogSFRNTFNjcmlwdEF0dHJpYnV0ZXNcbiAgc2VjdGlvbjogSFRNTEdlbmVyaWNTZWN0aW9uQXR0cmlidXRlc1xuICBzZWxlY3Q6IEhUTUxTZWxlY3RBdHRyaWJ1dGVzXG4gIHNsb3Q6IEhUTUxTbG90QXR0cmlidXRlc1xuICBzbWFsbDogSFRNTFNpZGVDb21tZW50QXR0cmlidXRlc1xuICBzb3VyY2U6IEhUTUxTb3VyY2VBdHRyaWJ1dGVzXG4gIHNwYW46IEhUTUxTcGFuQXR0cmlidXRlc1xuICBzdHJvbmc6IEhUTUxTdHJvbmdJbXBvcnRhbmNlQXR0cmlidXRlc1xuICBzdHlsZTogSFRNTFN0eWxlQXR0cmlidXRlc1xuICBzdWI6IEhUTUxTdWJzY3JpcHRBdHRyaWJ1dGVzXG4gIHN1bW1hcnk6IEhUTUxEaXNjbG9zdXJlU3VtbWFyeUF0dHJpYnV0ZXNcbiAgc3VwOiBIVE1MU3VwZXJzY3JpcHRBdHRyaWJ1dGVzXG4gIHRhYmxlOiBIVE1MVGFibGVBdHRyaWJ1dGVzXG4gIHRib2R5OiBIVE1MVGFibGVTZWN0aW9uQXR0cmlidXRlc1xuICB0ZDogSFRNTFRhYmxlU2VjdGlvbkF0dHJpYnV0ZXM8SFRNTFRhYmxlQ2VsbEVsZW1lbnQ+XG4gIHRlbXBsYXRlOiBIVE1MSGVhZEF0dHJpYnV0ZXNcbiAgdGV4dGFyZWE6IEhUTUxUZXh0YXJlYUF0dHJpYnV0ZXNcbiAgdGZvb3Q6IEhUTUxUYWJsZVNlY3Rpb25BdHRyaWJ1dGVzXG4gIHRoOiBIVE1MVGFibGVDZWxsQXR0cmlidXRlc1xuICB0aGVhZDogSFRNTFRhYmxlU2VjdGlvbkF0dHJpYnV0ZXNcbiAgdGltZTogSFRNTFRpbWVBdHRyaWJ1dGVzXG4gIHRpdGxlOiBIVE1MVGl0bGVBdHRyaWJ1dGVzXG4gIHRyOiBIVE1MVGFibGVSb3dBdHRyaWJ1dGVzXG4gIHRyYWNrOiBIVE1MVHJhY2tBdHRyaWJ1dGVzXG4gIHU6IEhUTUxVbmRlcmxpbmVBdHRyaWJ1dGVzXG4gIHVsOiBIVE1MVUxpc3RBdHRyaWJ1dGVzXG4gIHZhcjogSFRNTFZhcmlhYmxlQXR0cmlidXRlc1xuICB2aWRlbzogSFRNTFZpZGVvQXR0cmlidXRlc1xuICB3YnI6IEhUTUxMaW5lQnJlYWtPcHBvcnR1bml0eUF0dHJpYnV0ZXNcbiAgW3RhZ05hbWU6IHN0cmluZ106IEhUTUxBdHRyaWJ1dGVzPGFueT5cbn1cbmludGVyZmFjZSBTVkdFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcCB7XG4gIGE6IFNWR0F0dHJpYnV0ZXM8U1ZHQUVsZW1lbnQ+XG4gIHNjcmlwdDogU1ZHQXR0cmlidXRlczxTVkdTY3JpcHRFbGVtZW50PlxuICBzdHlsZTogU1ZHQXR0cmlidXRlczxTVkdTdHlsZUVsZW1lbnQ+XG4gIHRpdGxlOiBTVkdBdHRyaWJ1dGVzPFNWR1RpdGxlRWxlbWVudD5cbiAgYW5pbWF0ZTogU1ZHQXR0cmlidXRlczxTVkdBbmltYXRlRWxlbWVudD5cbiAgYW5pbWF0ZU1vdGlvbjogU1ZHQXR0cmlidXRlczxTVkdBbmltYXRlTW90aW9uRWxlbWVudD5cbiAgYW5pbWF0ZVRyYW5zZm9ybTogU1ZHQXR0cmlidXRlczxTVkdBbmltYXRlVHJhbnNmb3JtRWxlbWVudD5cbiAgY2lyY2xlOiBTVkdBdHRyaWJ1dGVzPFNWR0NpcmNsZUVsZW1lbnQ+XG4gIGNsaXBQYXRoOiBTVkdBdHRyaWJ1dGVzPFNWR0NsaXBQYXRoRWxlbWVudD5cbiAgZGVmczogU1ZHQXR0cmlidXRlczxTVkdEZWZzRWxlbWVudD5cbiAgZGVzYzogU1ZHQXR0cmlidXRlczxTVkdEZXNjRWxlbWVudD5cbiAgZWxsaXBzZTogU1ZHQXR0cmlidXRlczxTVkdFbGxpcHNlRWxlbWVudD5cbiAgZmVCbGVuZDogU1ZHQXR0cmlidXRlczxTVkdGRUJsZW5kRWxlbWVudD5cbiAgZmVDb2xvck1hdHJpeDogU1ZHQXR0cmlidXRlczxTVkdGRUNvbG9yTWF0cml4RWxlbWVudD5cbiAgZmVDb21wb25lbnRUcmFuc2ZlcjogU1ZHQXR0cmlidXRlczxTVkdGRUNvbXBvbmVudFRyYW5zZmVyRWxlbWVudD5cbiAgZmVDb21wb3NpdGU6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVDb21wb3NpdGVFbGVtZW50PlxuICBmZUNvbnZvbHZlTWF0cml4OiBTVkdBdHRyaWJ1dGVzPFNWR0ZFQ29udm9sdmVNYXRyaXhFbGVtZW50PlxuICBmZURpZmZ1c2VMaWdodGluZzogU1ZHQXR0cmlidXRlczxTVkdGRURpZmZ1c2VMaWdodGluZ0VsZW1lbnQ+XG4gIGZlRGlzcGxhY2VtZW50TWFwOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFRGlzcGxhY2VtZW50TWFwRWxlbWVudD5cbiAgZmVEaXN0YW50TGlnaHQ6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVEaXN0YW50TGlnaHRFbGVtZW50PlxuICBmZURyb3BTaGFkb3c6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVEcm9wU2hhZG93RWxlbWVudD5cbiAgZmVGbG9vZDogU1ZHQXR0cmlidXRlczxTVkdGRUZsb29kRWxlbWVudD5cbiAgZmVGdW5jQTogU1ZHQXR0cmlidXRlczxTVkdGRUZ1bmNBRWxlbWVudD5cbiAgZmVGdW5jQjogU1ZHQXR0cmlidXRlczxTVkdGRUZ1bmNCRWxlbWVudD5cbiAgZmVGdW5jRzogU1ZHQXR0cmlidXRlczxTVkdGRUZ1bmNHRWxlbWVudD5cbiAgZmVGdW5jUjogU1ZHQXR0cmlidXRlczxTVkdGRUZ1bmNSRWxlbWVudD5cbiAgZmVHYXVzc2lhbkJsdXI6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVHYXVzc2lhbkJsdXJFbGVtZW50PlxuICBmZUltYWdlOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFSW1hZ2VFbGVtZW50PlxuICBmZU1lcmdlOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFTWVyZ2VFbGVtZW50PlxuICBmZU1lcmdlTm9kZTogU1ZHQXR0cmlidXRlczxTVkdGRU1lcmdlTm9kZUVsZW1lbnQ+XG4gIGZlTW9ycGhvbG9neTogU1ZHQXR0cmlidXRlczxTVkdGRU1vcnBob2xvZ3lFbGVtZW50PlxuICBmZU9mZnNldDogU1ZHQXR0cmlidXRlczxTVkdGRU9mZnNldEVsZW1lbnQ+XG4gIGZlUG9pbnRMaWdodDogU1ZHQXR0cmlidXRlczxTVkdGRVBvaW50TGlnaHRFbGVtZW50PlxuICBmZVNwZWN1bGFyTGlnaHRpbmc6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVTcGVjdWxhckxpZ2h0aW5nRWxlbWVudD5cbiAgZmVTcG90TGlnaHQ6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVTcG90TGlnaHRFbGVtZW50PlxuICBmZVRpbGU6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVUaWxlRWxlbWVudD5cbiAgZmVUdXJidWxlbmNlOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFVHVyYnVsZW5jZUVsZW1lbnQ+XG4gIGZpbHRlcjogU1ZHQXR0cmlidXRlczxTVkdGaWx0ZXJFbGVtZW50PlxuICBmb3JlaWduT2JqZWN0OiBTVkdBdHRyaWJ1dGVzPFNWR0ZvcmVpZ25PYmplY3RFbGVtZW50PlxuICBnOiBTVkdBdHRyaWJ1dGVzPFNWR0dFbGVtZW50PlxuICBpbWFnZTogU1ZHQXR0cmlidXRlczxTVkdJbWFnZUVsZW1lbnQ+XG4gIGxpbmU6IFNWR0F0dHJpYnV0ZXM8U1ZHTGluZUVsZW1lbnQ+XG4gIGxpbmVhckdyYWRpZW50OiBTVkdBdHRyaWJ1dGVzPFNWR0xpbmVhckdyYWRpZW50RWxlbWVudD5cbiAgbWFya2VyOiBTVkdBdHRyaWJ1dGVzPFNWR01hcmtlckVsZW1lbnQ+XG4gIG1hc2s6IFNWR0F0dHJpYnV0ZXM8U1ZHTWFza0VsZW1lbnQ+XG4gIG1ldGFkYXRhOiBTVkdBdHRyaWJ1dGVzPFNWR01ldGFkYXRhRWxlbWVudD5cbiAgbXBhdGg6IFNWR0F0dHJpYnV0ZXM8U1ZHTVBhdGhFbGVtZW50PlxuICBwYXRoOiBTVkdBdHRyaWJ1dGVzPFNWR1BhdGhFbGVtZW50PlxuICBwYXR0ZXJuOiBTVkdBdHRyaWJ1dGVzPFNWR1BhdHRlcm5FbGVtZW50PlxuICBwb2x5Z29uOiBTVkdBdHRyaWJ1dGVzPFNWR1BvbHlnb25FbGVtZW50PlxuICBwb2x5bGluZTogU1ZHQXR0cmlidXRlczxTVkdQb2x5bGluZUVsZW1lbnQ+XG4gIHJhZGlhbEdyYWRpZW50OiBTVkdBdHRyaWJ1dGVzPFNWR1JhZGlhbEdyYWRpZW50RWxlbWVudD5cbiAgcmVjdDogU1ZHQXR0cmlidXRlczxTVkdSZWN0RWxlbWVudD5cbiAgc2V0OiBTVkdBdHRyaWJ1dGVzPFNWR1NldEVsZW1lbnQ+XG4gIHN0b3A6IFNWR0F0dHJpYnV0ZXM8U1ZHU3RvcEVsZW1lbnQ+XG4gIHN2ZzogU1ZHQXR0cmlidXRlc1xuICBzd2l0Y2g6IFNWR0F0dHJpYnV0ZXM8U1ZHU3dpdGNoRWxlbWVudD5cbiAgc3ltYm9sOiBTVkdBdHRyaWJ1dGVzPFNWR1N5bWJvbEVsZW1lbnQ+XG4gIHRleHQ6IFNWR0F0dHJpYnV0ZXM8U1ZHVGV4dEVsZW1lbnQ+XG4gIHRleHRQYXRoOiBTVkdBdHRyaWJ1dGVzPFNWR1RleHRQYXRoRWxlbWVudD5cbiAgdHNwYW46IFNWR0F0dHJpYnV0ZXM8U1ZHVFNwYW5FbGVtZW50PlxuICB1c2U6IFNWR0F0dHJpYnV0ZXM8U1ZHVXNlRWxlbWVudD5cbiAgdmlldzogU1ZHQXR0cmlidXRlczxTVkdWaWV3RWxlbWVudD5cbiAgW3RhZ05hbWU6IHN0cmluZ106IFNWR0F0dHJpYnV0ZXM8YW55PlxufVxuaW50ZXJmYWNlIEFyaWFBdHRyaWJ1dGVzIHtcbiAgcm9sZTogQXJpYVJvbGVcbiAgYXJpYUFjdGl2ZWRlc2NlbmRhbnQ6IHN0cmluZ1xuICBhcmlhQXRvbWljOiBCb29sZWFuTGlrZVxuICBhcmlhQXV0b2NvbXBsZXRlOiBzdHJpbmdcbiAgYXJpYUJ1c3k6IEJvb2xlYW5MaWtlXG4gIGFyaWFDaGVja2VkOiBCb29sZWFuTGlrZSB8IFwibWl4ZWRcIlxuICBhcmlhQ29sY291bnQ6IE51bWJlckxpa2VcbiAgYXJpYUNvbGluZGV4OiBOdW1iZXJMaWtlXG4gIGFyaWFDb2xzcGFuOiBOdW1iZXJMaWtlXG4gIGFyaWFDb250cm9sczogc3RyaW5nXG4gIGFyaWFDdXJyZW50OiBCb29sZWFuTGlrZSB8IFwicGFnZVwiIHwgXCJzdGVwXCIgfCBcImxvY2F0aW9uXCIgfCBcImRhdGVcIiB8IFwidGltZVwiXG4gIGFyaWFEZXNjcmliZWRieTogc3RyaW5nXG4gIGFyaWFEZXRhaWxzOiBzdHJpbmdcbiAgYXJpYURpc2FibGVkOiBCb29sZWFuTGlrZVxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYXJpYURyb3BlZmZlY3Q6IFwibm9uZVwiIHwgXCJjb3B5XCIgfCBcImV4ZWN1dGVcIiB8IFwibGlua1wiIHwgXCJtb3ZlXCIgfCBcInBvcHVwXCJcbiAgYXJpYUVycm9ybWVzc2FnZTogc3RyaW5nXG4gIGFyaWFFeHBhbmRlZDogQm9vbGVhbkxpa2VcbiAgYXJpYUZsb3d0bzogc3RyaW5nXG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhcmlhR3JhYmJlZDogQm9vbGVhbkxpa2VcbiAgYXJpYUhhc3BvcHVwOiBCb29sZWFuTGlrZSB8IFwibWVudVwiIHwgXCJsaXN0Ym94XCIgfCBcInRyZWVcIiB8IFwiZ3JpZFwiIHwgXCJkaWFsb2dcIlxuICBhcmlhSGlkZGVuOiBCb29sZWFuTGlrZVxuICBhcmlhSW52YWxpZDogQm9vbGVhbkxpa2UgfCBcImdyYW1tYXJcIiB8IFwic3BlbGxpbmdcIlxuICBhcmlhS2V5c2hvcnRjdXRzOiBzdHJpbmdcbiAgYXJpYUxhYmVsOiBzdHJpbmdcbiAgYXJpYUxhYmVsbGVkYnk6IHN0cmluZ1xuICBhcmlhTGV2ZWw6IE51bWJlckxpa2VcbiAgYXJpYUxpdmU6IFwib2ZmXCIgfCBcImFzc2VydGl2ZVwiIHwgXCJwb2xpdGVcIlxuICBhcmlhTW9kYWw6IEJvb2xlYW5MaWtlXG4gIGFyaWFNdWx0aWxpbmU6IEJvb2xlYW5MaWtlXG4gIGFyaWFNdWx0aXNlbGVjdGFibGU6IEJvb2xlYW5MaWtlXG4gIGFyaWFPcmllbnRhdGlvbjogXCJob3Jpem9udGFsXCIgfCBcInZlcnRpY2FsXCJcbiAgYXJpYU93bnM6IHN0cmluZ1xuICBhcmlhUGxhY2Vob2xkZXI6IHN0cmluZ1xuICBhcmlhUG9zaW5zZXQ6IE51bWJlckxpa2VcbiAgYXJpYVByZXNzZWQ6IEJvb2xlYW5MaWtlIHwgXCJtaXhlZFwiXG4gIGFyaWFSZWFkb25seTogQm9vbGVhbkxpa2VcbiAgYXJpYVJlbGV2YW50OlxuICAgIHwgXCJhZGRpdGlvbnNcIlxuICAgIHwgXCJhZGRpdGlvbnMgcmVtb3ZhbHNcIlxuICAgIHwgXCJhZGRpdGlvbnMgdGV4dFwiXG4gICAgfCBcImFsbFwiXG4gICAgfCBcInJlbW92YWxzXCJcbiAgICB8IFwicmVtb3ZhbHMgYWRkaXRpb25zXCJcbiAgICB8IFwicmVtb3ZhbHMgdGV4dFwiXG4gICAgfCBcInRleHRcIlxuICAgIHwgXCJ0ZXh0IGFkZGl0aW9uc1wiXG4gICAgfCBcInRleHQgcmVtb3ZhbHNcIlxuICBhcmlhUmVxdWlyZWQ6IEJvb2xlYW5MaWtlXG4gIGFyaWFSb2xlZGVzY3JpcHRpb246IHN0cmluZ1xuICBhcmlhUm93Y291bnQ6IE51bWJlckxpa2VcbiAgYXJpYVJvd2luZGV4OiBOdW1iZXJMaWtlXG4gIGFyaWFSb3dzcGFuOiBOdW1iZXJMaWtlXG4gIGFyaWFTZWxlY3RlZDogQm9vbGVhbkxpa2VcbiAgYXJpYVNldHNpemU6IE51bWJlckxpa2VcbiAgYXJpYVNvcnQ6IFwibm9uZVwiIHwgXCJhc2NlbmRpbmdcIiB8IFwiZGVzY2VuZGluZ1wiIHwgXCJvdGhlclwiXG4gIGFyaWFWYWx1ZW1heDogTnVtYmVyTGlrZVxuICBhcmlhVmFsdWVtaW46IE51bWJlckxpa2VcbiAgYXJpYVZhbHVlbm93OiBOdW1iZXJMaWtlXG4gIGFyaWFWYWx1ZXRleHQ6IHN0cmluZ1xuICBbYXJpYUF0dHJpYnV0ZTogYGFyaWEke0NhcGl0YWxpemU8c3RyaW5nPn1gXTpcbiAgICB8IHN0cmluZ1xuICAgIHwgTnVtYmVyTGlrZVxuICAgIHwgQm9vbGVhbkxpa2VcbiAgICB8IHVuZGVmaW5lZFxufVxuaW50ZXJmYWNlIEVsZW1lbnRBdHRyaWJ1dGVzIGV4dGVuZHMgQWNjZXNzYWJsZU9iamVjdDxBcmlhQXR0cmlidXRlcz4ge1xuICBpZDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGF1dG9mb2N1czogQWNjZXNzYWJsZTxib29sZWFuPlxuICBub25jZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRhYkluZGV4OiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgY29udGVudEVkaXRhYmxlOiBBY2Nlc3NhYmxlPEJvb2xlYW5MaWtlIHwgXCJpbmhlcml0XCI+XG4gIGVudGVyS2V5SGludDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGNsYXNzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgY2xhc3NOYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc2xvdDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGlubmVySFRNTDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRleHRDb250ZW50OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbGFuZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGlucHV0TW9kZTogQWNjZXNzYWJsZTxcbiAgICB8IFwibm9uZVwiXG4gICAgfCBcInRleHRcIlxuICAgIHwgXCJ0ZWxcIlxuICAgIHwgXCJ1cmxcIlxuICAgIHwgXCJlbWFpbFwiXG4gICAgfCBcIm51bWVyaWNcIlxuICAgIHwgXCJkZWNpbWFsXCJcbiAgICB8IFwic2VhcmNoXCJcbiAgICB8IEFueVN0cmluZ1xuICA+XG4gIHN0eWxlOiBBY2Nlc3NhYmxlT2JqZWN0PFN0eWxlcz4gfCBBY2Nlc3NhYmxlPHN0cmluZz4gfCBBY2Nlc3NhYmxlPFN0eWxlcz5cbiAgW3Vua25vd25BdHRyaWJ1dGU6IHN0cmluZ106IGFueVxufVxudHlwZSBFdmVudEhhbmRsZXI8VCwgRT4gPSAoZXZlbnQ6IEUgJiB7IGN1cnJlbnRUYXJnZXQ6IFQgfSkgPT4gdm9pZFxuaW50ZXJmYWNlIEhUTUxBdHRyaWJ1dGVzPFQgPSBIVE1MRWxlbWVudD5cbiAgZXh0ZW5kcyBFbGVtZW50QXR0cmlidXRlcywgRXZlbnRBdHRyaWJ1dGVzPFQ+IHtcbiAgYWNjZXNzS2V5OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZGlyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZHJhZ2dhYmxlOiBBY2Nlc3NhYmxlPEJvb2xlYW5MaWtlPlxuICBoaWRkZW46IEFjY2Vzc2FibGU8Qm9vbGVhbkxpa2U+XG4gIGlubmVyVGV4dDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGxhbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcGVsbGNoZWNrOiBBY2Nlc3NhYmxlPEJvb2xlYW5MaWtlPlxuICB0aXRsZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRyYW5zbGF0ZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICBpczogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEFuY2hvckF0dHJpYnV0ZXNcbiAgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MQW5jaG9yRWxlbWVudD4sIEh5cGVybGlua0hUTUxBdHRyaWJ1dGVzIHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNoYXJzZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29vcmRzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZG93bmxvYWQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBocmVmbGFuZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcGluZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJlZmVycmVyUG9saWN5OiBBY2Nlc3NhYmxlPEhUTUxBdHRyaWJ1dGVSZWZlcnJlclBvbGljeT5cbiAgcmVsOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHJldjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzaGFwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRhcmdldDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRleHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MQXJlYUF0dHJpYnV0ZXNcbiAgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MQXJlYUVsZW1lbnQ+LCBIeXBlcmxpbmtIVE1MQXR0cmlidXRlcyB7XG4gIGFsdDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGNvb3JkczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRvd25sb2FkOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG5vSHJlZjogQWNjZXNzYWJsZTxib29sZWFuPlxuICBwaW5nOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcmVmZXJyZXJQb2xpY3k6IEFjY2Vzc2FibGU8SFRNTEF0dHJpYnV0ZVJlZmVycmVyUG9saWN5PlxuICByZWw6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzaGFwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRhcmdldDogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEF1ZGlvQXR0cmlidXRlcyBleHRlbmRzIEhUTUxNZWRpYUF0dHJpYnV0ZXM8SFRNTEF1ZGlvRWxlbWVudD4ge31cbmludGVyZmFjZSBIVE1MQlJBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEJSRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2xlYXI6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxCYXNlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxCYXNlRWxlbWVudD4ge1xuICBocmVmOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdGFyZ2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MQm9keUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MQm9keUVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFMaW5rOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJhY2tncm91bmQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYmdDb2xvcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBsaW5rOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHRleHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdkxpbms6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxCdXR0b25BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEJ1dHRvbkVsZW1lbnQ+IHtcbiAgZGlzYWJsZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgZm9ybUFjdGlvbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZvcm1FbmN0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZm9ybU1ldGhvZDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZvcm1Ob1ZhbGlkYXRlOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGZvcm1UYXJnZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHZhbHVlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MQ2FudmFzQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxDYW52YXNFbGVtZW50PiB7XG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxufVxuaW50ZXJmYWNlIEhUTUxETEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MRExpc3RFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjb21wYWN0OiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG59XG5pbnRlcmZhY2UgSFRNTERhdGFBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTERhdGFFbGVtZW50PiB7XG4gIHZhbHVlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MRGF0YUxpc3RBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTERhdGFMaXN0RWxlbWVudD4ge31cbmludGVyZmFjZSBIVE1MRGV0YWlsc0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MRGV0YWlsc0VsZW1lbnQ+IHtcbiAgb3BlbjogQWNjZXNzYWJsZTxib29sZWFuPlxufVxuaW50ZXJmYWNlIEhUTUxEaWFsb2dBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTERpYWxvZ0VsZW1lbnQ+IHt9XG5pbnRlcmZhY2UgSFRNTERpcmVjdG9yeUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MRGlyZWN0b3J5RWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29tcGFjdDogQWNjZXNzYWJsZTxib29sZWFuPlxufVxuaW50ZXJmYWNlIEhUTUxEaXZBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTERpdkVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MRW1iZWRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEVtYmVkRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MRmllbGRzZXRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEZpZWxkU2V0RWxlbWVudD4ge1xuICBkaXNhYmxlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MRm9udEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MRm9udEVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbG9yOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGZhY2U6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc2l6ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEZvcm1BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEZvcm1FbGVtZW50PiB7XG4gIGFjY2VwdENoYXJzZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBhY3Rpb246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBhdXRvY29tcGxldGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBlbmNvZGluZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGVuY3R5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBtZXRob2Q6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbm9WYWxpZGF0ZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICB0YXJnZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxGcmFtZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MRnJhbWVFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBmcmFtZUJvcmRlcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBsb25nRGVzYzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBtYXJnaW5IZWlnaHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbWFyZ2luV2lkdGg6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBub1Jlc2l6ZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc2Nyb2xsaW5nOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHNyYzogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEZyYW1lU2V0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxGcmFtZVNldEVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbHM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHJvd3M6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MSFJBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEhSRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29sb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbm9TaGFkZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc2l6ZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MSGVhZGluZ0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MSGVhZGluZ0VsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MSGVhZEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MSGVhZEVsZW1lbnQ+IHt9XG5pbnRlcmZhY2UgSFRNTEh0bWxBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEh0bWxFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2ZXJzaW9uOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIeXBlcmxpbmtIVE1MQXR0cmlidXRlcyB7XG4gIGhhc2g6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBob3N0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaG9zdG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBocmVmOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcGFzc3dvcmQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwYXRobmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHBvcnQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwcm90b2NvbDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNlYXJjaDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHVzZXJuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MSUZyYW1lQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxJRnJhbWVFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGFsbG93OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgYWxsb3dGdWxsc2NyZWVuOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBmcmFtZUJvcmRlcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbG9uZ0Rlc2M6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbWFyZ2luSGVpZ2h0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBtYXJnaW5XaWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcmVmZXJyZXJQb2xpY3k6IEFjY2Vzc2FibGU8SFRNTEF0dHJpYnV0ZVJlZmVycmVyUG9saWN5PlxuICBzY3JvbGxpbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmNkb2M6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB3aWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxufVxuaW50ZXJmYWNlIEhUTUxJbWFnZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MSW1hZ2VFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGFsdDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBib3JkZXI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjcm9zc09yaWdpbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRlY29kaW5nOiBBY2Nlc3NhYmxlPFwiYXN5bmNcIiB8IFwiYXV0b1wiIHwgXCJzeW5jXCIgfCBBbnlTdHJpbmc+XG4gIGhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgaHNwYWNlOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgaXNNYXA6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgbG9hZGluZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBsb25nRGVzYzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBsb3dzY3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJlZmVycmVyUG9saWN5OiBBY2Nlc3NhYmxlPEhUTUxBdHRyaWJ1dGVSZWZlcnJlclBvbGljeT5cbiAgc2l6ZXM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmNzZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB1c2VNYXA6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdnNwYWNlOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MSW5wdXRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTElucHV0RWxlbWVudD4ge1xuICBhY2NlcHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBhbHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBhdXRvY29tcGxldGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjYXB0dXJlOiBBY2Nlc3NhYmxlPEJvb2xlYW5MaWtlPlxuICBjaGVja2VkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGRlZmF1bHRDaGVja2VkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGRlZmF1bHRWYWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRpck5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkaXNhYmxlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBmaWxlczogQWNjZXNzYWJsZTxGaWxlTGlzdD5cbiAgZm9ybUFjdGlvbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZvcm1FbmN0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZm9ybU1ldGhvZDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZvcm1Ob1ZhbGlkYXRlOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGZvcm1UYXJnZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgaW5kZXRlcm1pbmF0ZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICBtYXg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbWF4TGVuZ3RoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG1pbjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBtaW5MZW5ndGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbXVsdGlwbGU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHBhdHRlcm46IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwbGFjZWhvbGRlcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJlYWRPbmx5OiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIHJlcXVpcmVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIHNlbGVjdGlvbkRpcmVjdGlvbjogQWNjZXNzYWJsZTxcImZvcndhcmRcIiB8IFwiYmFja3dhcmRcIiB8IFwibm9uZVwiIHwgQW55U3RyaW5nPlxuICBzZWxlY3Rpb25FbmQ6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICBzZWxlY3Rpb25TdGFydDogQWNjZXNzYWJsZTxudW1iZXI+XG4gIHNpemU6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3JjOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3RlcDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB0eXBlOiBBY2Nlc3NhYmxlPEhUTUxJbnB1dFR5cGVBdHRyaWJ1dGU+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB1c2VNYXA6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHdlYmtpdGRpcmVjdG9yeTogQWNjZXNzYWJsZTxib29sZWFuPlxuICB3aWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxufVxuaW50ZXJmYWNlIEhUTUxMSUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MTElFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MTGFiZWxBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTExhYmVsRWxlbWVudD4ge1xuICBodG1sRm9yOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MTGVnZW5kQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxMZWdlbmRFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTExpbmtBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTExpbmtFbGVtZW50PiB7XG4gIGFzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNoYXJzZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjcm9zc09yaWdpbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRpc2FibGVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGhyZWY6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBocmVmbGFuZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGltYWdlU2l6ZXM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBpbWFnZVNyY3NldDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIG1lZGlhOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcmVmZXJyZXJQb2xpY3k6IEFjY2Vzc2FibGU8SFRNTEF0dHJpYnV0ZVJlZmVycmVyUG9saWN5PlxuICByZWw6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICByZXY6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdGFyZ2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNoZWV0OiBBY2Nlc3NhYmxlPFN0eWxlcz5cbn1cbmludGVyZmFjZSBIVE1MTWFwQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxNYXBFbGVtZW50PiB7XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxNYXJxdWVlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxNYXJxdWVlRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYmVoYXZpb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYmdDb2xvcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBkaXJlY3Rpb246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgaGVpZ2h0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGhzcGFjZTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBsb29wOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHNjcm9sbEFtb3VudDogQWNjZXNzYWJsZTxudW1iZXI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzY3JvbGxEZWxheTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB0cnVlU3BlZWQ6IGJvb2xlYW5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZzcGFjZTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB3aWR0aDogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTE1lZGlhQXR0cmlidXRlczxUPiBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPFQ+IHtcbiAgYXV0b3BsYXk6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgY29udHJvbHM6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgY3Jvc3NPcmlnaW46IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjdXJyZW50VGltZTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIGRlZmF1bHRNdXRlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBkZWZhdWx0UGxheWJhY2tSYXRlOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgbG9vcDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBtdXRlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBwbGF5YmFja1JhdGU6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICBwcmVsb2FkOiBBY2Nlc3NhYmxlPFwibm9uZVwiIHwgXCJtZXRhZGF0YVwiIHwgXCJhdXRvXCIgfCBBbnlTdHJpbmc+XG4gIHNyYzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNyY09iamVjdDogQWNjZXNzYWJsZTxNZWRpYVN0cmVhbT5cbiAgdm9sdW1lOiBBY2Nlc3NhYmxlPG51bWJlcj5cbn1cbmludGVyZmFjZSBIVE1MTWVudUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MTWVudUVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbXBhY3Q6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbn1cbmludGVyZmFjZSBIVE1MTWV0YUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MTWV0YUVsZW1lbnQ+IHtcbiAgY29udGVudDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGh0dHBFcXVpdjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc2NoZW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MTWV0ZXJBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTE1ldGVyRWxlbWVudD4ge1xuICBoaWdoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGxvdzogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBtYXg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbWluOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG9wdGltdW06IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxNb2RBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTE1vZEVsZW1lbnQ+IHtcbiAgY2l0ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRhdGVUaW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MT0xpc3RBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTE9MaXN0RWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29tcGFjdDogQWNjZXNzYWJsZTxib29sZWFuPlxuICByZXZlcnNlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBzdGFydDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MT2JqZWN0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxPYmplY3RFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhcmNoaXZlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJvcmRlcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjb2RlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvZGVCYXNlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvZGVUeXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZGF0YTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBkZWNsYXJlOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgaHNwYWNlOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzdGFuZGJ5OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHVzZU1hcDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2c3BhY2U6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICB3aWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxufVxuaW50ZXJmYWNlIEhUTUxPcHRHcm91cEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MT3B0R3JvdXBFbGVtZW50PiB7XG4gIGRpc2FibGVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGxhYmVsOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MT3B0aW9uQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxPcHRpb25FbGVtZW50PiB7XG4gIGRlZmF1bHRTZWxlY3RlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBkaXNhYmxlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBsYWJlbDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNlbGVjdGVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIHRleHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmdbXSB8IG51bWJlcj5cbn1cbmludGVyZmFjZSBIVE1MT3V0cHV0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxPdXRwdXRFbGVtZW50PiB7XG4gIGRlZmF1bHRWYWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFBhcmFncmFwaEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MUGFyYWdyYXBoRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxQYXJhbUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MUGFyYW1FbGVtZW50PiB7XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHZhbHVlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZhbHVlVHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFByZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MUHJlRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgd2lkdGg6IEFjY2Vzc2FibGU8bnVtYmVyPlxufVxuaW50ZXJmYWNlIEhUTUxQcm9ncmVzc0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MUHJvZ3Jlc3NFbGVtZW50PiB7XG4gIG1heDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmdbXSB8IG51bWJlcj5cbn1cbmludGVyZmFjZSBIVE1MUXVvdGVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFF1b3RlRWxlbWVudD4ge1xuICBjaXRlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MU2NyaXB0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxTY3JpcHRFbGVtZW50PiB7XG4gIGFzeW5jOiBBY2Nlc3NhYmxlPEJvb2xlYW5MaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2hhcnNldDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGNyb3NzT3JpZ2luOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZGVmZXI6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGV2ZW50OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGh0bWxGb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBpbnRlZ3JpdHk6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBub01vZHVsZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICByZWZlcnJlclBvbGljeTogQWNjZXNzYWJsZTxIVE1MQXR0cmlidXRlUmVmZXJyZXJQb2xpY3k+XG4gIHNyYzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRleHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MU2VsZWN0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxTZWxlY3RFbGVtZW50PiB7XG4gIGF1dG9jb21wbGV0ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRpc2FibGVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGxlbmd0aDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIG11bHRpcGxlOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICByZXF1aXJlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBzZWxlY3RlZEluZGV4OiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgc2l6ZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFNsb3RBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFNsb3RFbGVtZW50PiB7XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxTb3VyY2VBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFNvdXJjZUVsZW1lbnQ+IHtcbiAgbWVkaWE6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzaXplczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNyYzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNyY1NldDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxTdHlsZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MU3R5bGVFbGVtZW50PiB7XG4gIG1lZGlhOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxUYWJsZUNhcHRpb25BdHRyaWJ1dGVzXG4gIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFRhYmxlQ2FwdGlvbkVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MVGFibGVDZWxsQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxUYWJsZUNlbGxFbGVtZW50PiB7XG4gIGFiYnI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYXhpczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBiZ0NvbG9yOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNoOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNoT2ZmOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgY29sU3BhbjogQWNjZXNzYWJsZTxudW1iZXI+XG4gIGhlYWRlcnM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgaGVpZ2h0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBub1dyYXA6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcm93U3BhbjogQWNjZXNzYWJsZTxudW1iZXI+XG4gIHNjb3BlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZBbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB3aWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxufVxuaW50ZXJmYWNlIEhUTUxUYWJsZUNvbEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MVGFibGVDb2xFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaE9mZjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNwYW46IEFjY2Vzc2FibGU8bnVtYmVyPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdkFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTFRhYmxlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxUYWJsZUVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJnQ29sb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYm9yZGVyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNlbGxQYWRkaW5nOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNlbGxTcGFjaW5nOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGZyYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHJ1bGVzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHN1bW1hcnk6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MVGFibGVSb3dBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFRhYmxlUm93RWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYmdDb2xvcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaE9mZjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2QWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxUYWJsZVNlY3Rpb25BdHRyaWJ1dGVzPFQgPSBIVE1MVGFibGVTZWN0aW9uRWxlbWVudD5cbiAgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxUPiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaE9mZjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2QWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxUZXh0YXJlYUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MVGV4dEFyZWFFbGVtZW50PiB7XG4gIGF1dG9jb21wbGV0ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGNvbHM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgZGVmYXVsdFZhbHVlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZGlyTmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRpc2FibGVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIG1heExlbmd0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBtaW5MZW5ndGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHBsYWNlaG9sZGVyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcmVhZE9ubHk6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcmVxdWlyZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcm93czogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzZWxlY3Rpb25EaXJlY3Rpb246IEFjY2Vzc2FibGU8XCJmb3J3YXJkXCIgfCBcImJhY2t3YXJkXCIgfCBcIm5vbmVcIiB8IEFueVN0cmluZz5cbiAgc2VsZWN0aW9uU3RhcnQ6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHdyYXA6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxUaW1lQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxUaW1lRWxlbWVudD4ge1xuICBkYXRlVGltZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFRpdGxlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxUaXRsZUVsZW1lbnQ+IHtcbiAgdGV4dDogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFRyYWNrQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxUcmFja0VsZW1lbnQ+IHtcbiAgZGVmYXVsdDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBraW5kOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbGFiZWw6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmNsYW5nOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MVUxpc3RBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFVMaXN0RWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29tcGFjdDogQWNjZXNzYWJsZTxib29sZWFuPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFZpZGVvQXR0cmlidXRlcyBleHRlbmRzIEhUTUxNZWRpYUF0dHJpYnV0ZXM8SFRNTFZpZGVvRWxlbWVudD4ge1xuICBkaXNhYmxlUGljdHVyZUluUGljdHVyZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcGxheXNJbmxpbmU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcG9zdGVyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MQWJicmV2aWF0aW9uQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEFkZHJlc3NBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MQXJ0aWNsZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxBc2lkZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxBdHRlbnRpb25BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MQmlkaXJlY3Rpb25hbElzb2xhdGVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MQmlkaXJlY3Rpb25hbFRleHRPdmVycmlkZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxDaXRhdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxJbmxpbmVDb2RlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTERlc2NyaXB0aW9uRGV0YWlsc0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxEZWZpbml0aW9uQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTERlc2NyaXB0aW9uVGVybUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxFbXBoYXNpc0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxGaWd1cmVDYXB0aW9uQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEZpZ3VyZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxGb290ZXJBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MSGVhZGVyQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEhlYWRpbmdHcm91cEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxJZGlvbWF0aWNUZXh0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEtleWJvYXJkSW5wdXRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MTWFpbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxNYXJrVGV4dEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxOYXZpZ2F0aW9uU2VjdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxOb1NjcmlwdEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxSdWJ5RmFsbGJhY2tQYXJlbnRoZXNpc0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxSdWJ5VGV4dEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxSdWJ5QW5ub3RhdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxTdHJpa2VUaHJvdWdoQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTFNhbXBsZU91dHB1dEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxHZW5lcmljU2VjdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxTaWRlQ29tbWVudEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxTdHJvbmdJbXBvcnRhbmNlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTFN1YnNjcmlwdEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxEaXNjbG9zdXJlU3VtbWFyeUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxTdXBlcnNjcmlwdEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxVbmRlcmxpbmVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MVmFyaWFibGVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MTGluZUJyZWFrT3Bwb3J0dW5pdHlBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MUGljdHVyZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MUGljdHVyZUVsZW1lbnQ+IHt9XG5pbnRlcmZhY2UgSFRNTFNwYW5BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFNwYW5FbGVtZW50PiB7fVxuaW50ZXJmYWNlIFNWR0F0dHJpYnV0ZXM8VCA9IFNWR0VsZW1lbnQ+XG4gIGV4dGVuZHMgRWxlbWVudEF0dHJpYnV0ZXMsIEV2ZW50QXR0cmlidXRlczxUPiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImFjY2VudC1oZWlnaHRcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBhY2N1bXVsYXRlOiBBY2Nlc3NhYmxlPFwibm9uZVwiIHwgXCJzdW1cIj5cbiAgYWRkaXRpdmU6IEFjY2Vzc2FibGU8XCJyZXBsYWNlXCIgfCBcInN1bVwiPlxuICBcImFsaWdubWVudC1iYXNlbGluZVwiOiBBY2Nlc3NhYmxlPFxuICAgIHwgXCJhdXRvXCJcbiAgICB8IFwiYmFzZWxpbmVcIlxuICAgIHwgXCJiZWZvcmUtZWRnZVwiXG4gICAgfCBcInRleHQtYmVmb3JlLWVkZ2VcIlxuICAgIHwgXCJtaWRkbGVcIlxuICAgIHwgXCJjZW50cmFsXCJcbiAgICB8IFwiYWZ0ZXItZWRnZVwiXG4gICAgfCBcInRleHQtYWZ0ZXItZWRnZVwiXG4gICAgfCBcImlkZW9ncmFwaGljXCJcbiAgICB8IFwiYWxwaGFiZXRpY1wiXG4gICAgfCBcImhhbmdpbmdcIlxuICAgIHwgXCJtYXRoZW1hdGljYWxcIlxuICAgIHwgXCJ0b3BcIlxuICAgIHwgXCJjZW50ZXJcIlxuICAgIHwgXCJib3R0b21cIlxuICA+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbHBoYWJldGljOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGFtcGxpdHVkZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJhcmFiaWMtZm9ybVwiOiBBY2Nlc3NhYmxlPFwiaW5pdGlhbFwiIHwgXCJtZWRpYWxcIiB8IFwidGVybWluYWxcIiB8IFwiaXNvbGF0ZWRcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFzY2VudDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBhdHRyaWJ1dGVOYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGF0dHJpYnV0ZVR5cGU6IEFjY2Vzc2FibGU8XCJDU1NcIiB8IFwiWE1MXCIgfCBcImF1dG9cIj5cbiAgYXppbXV0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBiYXNlRnJlcXVlbmN5OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwiYmFzZWxpbmUtc2hpZnRcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlIHwgXCJzdWJcIiB8IFwic3VwZXJcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJhc2VQcm9maWxlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJib3g6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBiZWdpbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGJpYXM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgYnk6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjYWxjTW9kZTogQWNjZXNzYWJsZTxcImRpc2NyZXRlXCIgfCBcImxpbmVhclwiIHwgXCJwYWNlZFwiIHwgXCJzcGxpbmVcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwiY2FwLWhlaWdodFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjbGlwOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJjbGlwLXBhdGhcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGNsaXBQYXRoVW5pdHM6IEFjY2Vzc2FibGU8XCJ1c2VyU3BhY2VPblVzZVwiIHwgXCJvYmplY3RCb3VuZGluZ0JveFwiPlxuICBcImNsaXAtcnVsZVwiOiBBY2Nlc3NhYmxlPFwibm9uemVyb1wiIHwgXCJldmVub2RkXCIgfCBcImluaGVyaXRcIj5cbiAgXCJjb2xvci1pbnRlcnBvbGF0aW9uXCI6IEFjY2Vzc2FibGU8XCJhdXRvXCIgfCBcInNSR0JcIiB8IFwibGluZWFyUkdCXCI+XG4gIFwiY29sb3ItaW50ZXJwb2xhdGlvbi1maWx0ZXJzXCI6IEFjY2Vzc2FibGU8XG4gICAgXCJhdXRvXCIgfCBcInNSR0JcIiB8IFwibGluZWFyUkdCXCIgfCBcImluaGVyaXRcIlxuICA+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImNvbG9yLXByb2ZpbGVcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImNvbG9yLXJlbmRlcmluZ1wiOiBBY2Nlc3NhYmxlPFwiYXV0b1wiIHwgXCJvcHRpbWl6ZVNwZWVkXCIgfCBcIm9wdGltaXplUXVhbGl0eVwiPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29udGVudFNjcmlwdFR5cGU6IEFjY2Vzc2FibGU8YCR7c3RyaW5nfS8ke3N0cmluZ31gPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29udGVudFN0eWxlVHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGN1cnNvcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGN4OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGN5OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkZWNlbGVyYXRlOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBkZXNjZW50OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGRpZmZ1c2VDb25zdGFudDogQWNjZXNzYWJsZTxcImx0clwiIHwgXCJydGxcIj5cbiAgZGlyZWN0aW9uOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGRpc3BsYXk6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkaXZpc29yOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwiZG9taW5hbnQtYmFzZWxpbmVcIjogQWNjZXNzYWJsZTxcbiAgICB8IFwiYXV0b1wiXG4gICAgfCBcInRleHQtYm90dG9tXCJcbiAgICB8IFwiYWxwaGFiZXRpY1wiXG4gICAgfCBcImlkZW9ncmFwaGljXCJcbiAgICB8IFwibWlkZGxlXCJcbiAgICB8IFwiY2VudHJhbFwiXG4gICAgfCBcIm1hdGhlbWF0aWNhbFwiXG4gICAgfCBcImhhbmdpbmdcIlxuICAgIHwgXCJ0ZXh0LXRvcFwiXG4gID5cbiAgZHVyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZHg6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkeTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGVkZ2VNb2RlOiBBY2Nlc3NhYmxlPFwiZHVwbGljYXRlXCIgfCBcIndyYXBcIiB8IFwibm9uZVwiPlxuICBlbGV2YXRpb246IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwiZW5hYmxlLWJhY2tncm91bmRcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGVuZDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGV4cG9uZW50OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGZpbGw6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcImZpbGwtb3BhY2l0eVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwiZmlsbC1ydWxlXCI6IEFjY2Vzc2FibGU8XCJub256ZXJvXCIgfCBcImV2ZW5vZGRcIiB8IFwiaW5oZXJpdFwiPlxuICBmaWx0ZXI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZmlsdGVyUmVzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZmlsdGVyVW5pdHM6IEFjY2Vzc2FibGU8XCJ1c2VyU3BhY2VPblVzZVwiIHwgXCJvYmplY3RCb3VuZGluZ0JveFwiPlxuICBcImZsb29kLWNvbG9yXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcImZsb29kLW9wYWNpdHlcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcImZvbnQtZmFtaWx5XCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcImZvbnQtc2l6ZVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwiZm9udC1zaXplLWFkanVzdFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwiZm9udC1zdHJldGNoXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJmb250LXN0eWxlXCI6IEFjY2Vzc2FibGU8XCJub3JtYWxcIiB8IFwiaXRhbGljXCIgfCBcIm9ibGlxdWVcIj5cbiAgXCJmb250LXZhcmlhbnRcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIFwiZm9udC13ZWlnaHRcIjogQWNjZXNzYWJsZTxcbiAgICBOdW1iZXJMaWtlIHwgXCJub3JtYWxcIiB8IFwiYm9sZFwiIHwgXCJib2xkZXJcIiB8IFwibGlnaHRlclwiXG4gID5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGZvcm1hdDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZyOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGZyb206IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgZng6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgZnk6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGcxOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGcyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwiZ2x5cGgtbmFtZVwiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwiZ2x5cGgtb3JpZW50YXRpb24taG9yaXpvbnRhbFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImdseXBoLW9yaWVudGF0aW9uLXZlcnRpY2FsXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGdseXBoUmVmOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGdyYWRpZW50VHJhbnNmb3JtOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZ3JhZGllbnRVbml0czogQWNjZXNzYWJsZTxcInVzZXJTcGFjZU9uVXNlXCIgfCBcIm9iamVjdEJvdW5kaW5nQm94XCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBoYW5naW5nOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJob3Jpei1hZHYteFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImhvcml6LW9yaWdpbi14XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGlkZW9ncmFwaGljOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwiaW1hZ2UtcmVuZGVyaW5nXCI6IEFjY2Vzc2FibGU8XCJhdXRvXCIgfCBcIm9wdGltaXplU3BlZWRcIiB8IFwib3B0aW1pemVRdWFsaXR5XCI+XG4gIGluMjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBpbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGludGVyY2VwdDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBrMTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBrMjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBrMzogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBrNDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgazogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBrZXJuZWxNYXRyaXg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGtlcm5lbFVuaXRMZW5ndGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGtlcm5pbmc6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZSB8IFwiYXV0b1wiPlxuICBrZXlQb2ludHM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAga2V5U3BsaW5lczogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBrZXlUaW1lczogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBsZW5ndGhBZGp1c3Q6IEFjY2Vzc2FibGU8XCJzcGFjaW5nXCIgfCBcInNwYWNpbmdBbmRHbHlwaHNcIj5cbiAgXCJsZXR0ZXItc3BhY2luZ1wiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2UgfCBcIm5vcm1hbFwiPlxuICBcImxpZ2h0aW5nLWNvbG9yXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBsaW1pdGluZ0NvbmVBbmdsZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcIm1hcmtlci1lbmRcIjogQWNjZXNzYWJsZTxgdXJsKCMke3N0cmluZ30pYD5cbiAgbWFya2VySGVpZ2h0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwibWFya2VyLW1pZFwiOiBBY2Nlc3NhYmxlPGB1cmwoIyR7c3RyaW5nfSlgPlxuICBcIm1hcmtlci1zdGFydFwiOiBBY2Nlc3NhYmxlPGB1cmwoIyR7c3RyaW5nfSlgPlxuICBtYXJrZXJVbml0czogQWNjZXNzYWJsZTxcInVzZXJTcGFjZU9uVXNlXCIgfCBcIm9iamVjdEJvdW5kaW5nQm94XCI+XG4gIG1hcmtlcldpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG1hc2s6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBtYXNrQ29udGVudFVuaXRzOiBBY2Nlc3NhYmxlPFwidXNlclNwYWNlT25Vc2VcIiB8IFwib2JqZWN0Qm91bmRpbmdCb3hcIj5cbiAgbWFza1VuaXRzOiBBY2Nlc3NhYmxlPFwidXNlclNwYWNlT25Vc2VcIiB8IFwib2JqZWN0Qm91bmRpbmdCb3hcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG1hdGhlbWF0aWNhbDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBtZWRpYTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZXhwZXJpbWVudGFsICovXG4gIG1ldGhvZDogQWNjZXNzYWJsZTxcImFsaWduXCIgfCBcInN0cmV0Y2hcIj5cbiAgbW9kZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbnVtT2N0YXZlczogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBvZmZzZXQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgb3BhY2l0eTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBvcGVyYXRvcjogQWNjZXNzYWJsZTxcbiAgICB8IFwib3ZlclwiXG4gICAgfCBcImluXCJcbiAgICB8IFwib3V0XCJcbiAgICB8IFwiYXRvcFwiXG4gICAgfCBcInhvclwiXG4gICAgfCBcImxpZ2h0ZXJcIlxuICAgIHwgXCJhcml0aG1ldGljXCJcbiAgICB8IFwiZXJvZGVcIlxuICAgIHwgXCJkaWxhdGVcIlxuICA+XG4gIG9yZGVyOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG9yaWVudDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlIHwgXCJhdXRvXCIgfCBcImF1dG8tc3RhcnQtcmV2ZXJzZVwiPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgb3JpZW50YXRpb246IEFjY2Vzc2FibGU8XCJoXCIgfCBcInZcIj5cbiAgb3JpZ2luOiBBY2Nlc3NhYmxlPFwiZGVmYXVsdFwiPlxuICBvdmVyZmxvdzogQWNjZXNzYWJsZTxcInZpc2libGVcIiB8IFwiaGlkZGVuXCIgfCBcInNjcm9sbFwiIHwgXCJhdXRvXCI+XG4gIFwib3ZlcmxpbmUtcG9zaXRpb25cIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcIm92ZXJsaW5lLXRoaWNrbmVzc1wiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwicGFpbnQtb3JkZXJcIjogQWNjZXNzYWJsZTxcIm5vcm1hbFwiIHwgXCJmaWxsXCIgfCBcInN0cm9rZVwiIHwgXCJtYXJrZXJzXCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInBhbm9zZS0xXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcGF0aDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHBhdGhMZW5ndGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcGF0dGVybkNvbnRlbnRVbml0czogQWNjZXNzYWJsZTxcInVzZXJTcGFjZU9uVXNlXCIgfCBcIm9iamVjdEJvdW5kaW5nQm94XCI+XG4gIHBhdHRlcm5UcmFuc2Zvcm06IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcGF0dGVyblVuaXRzOiBBY2Nlc3NhYmxlPFwidXNlclNwYWNlT25Vc2VcIiB8IFwib2JqZWN0Qm91bmRpbmdCb3hcIj5cbiAgXCJwb2ludGVyLWV2ZW50c1wiOiBBY2Nlc3NhYmxlPFxuICAgIHwgXCJib3VuZGluZy1ib3hcIlxuICAgIHwgXCJ2aXNpYmxlUGFpbnRlZFwiXG4gICAgfCBcInZpc2libGVGaWxsXCJcbiAgICB8IFwidmlzaWJsZVN0cm9rZVwiXG4gICAgfCBcInZpc2libGVcIlxuICAgIHwgXCJwYWludGVkXCJcbiAgICB8IFwiZmlsbFwiXG4gICAgfCBcInN0cm9rZVwiXG4gICAgfCBcImFsbFwiXG4gICAgfCBcIm5vbmVcIlxuICA+XG4gIHBvaW50czogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHBvaW50c0F0WDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBwb2ludHNBdFk6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcG9pbnRzQXRaOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHByZXNlcnZlQWxwaGE6IEFjY2Vzc2FibGU8Qm9vbGVhbkxpa2U+XG4gIHByZXNlcnZlQXNwZWN0UmF0aW86IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwcmltaXRpdmVVbml0czogQWNjZXNzYWJsZTxcInVzZXJTcGFjZU9uVXNlXCIgfCBcIm9iamVjdEJvdW5kaW5nQm94XCI+XG4gIHI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcmFkaXVzOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHJlZlg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcmVmWTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInJlbmRlcmluZy1pbnRlbnRcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICByZXBlYXRDb3VudDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlIHwgXCJpbmRlZmluaXRlXCI+XG4gIHJlcGVhdER1cjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlIHwgXCJpbmRlZmluaXRlXCI+XG4gIHJlcXVpcmVkRXh0ZW5zaW9uczogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgcmVxdWlyZWRGZWF0dXJlczogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICByZXN0YXJ0OiBBY2Nlc3NhYmxlPFwiYWx3YXlzXCIgfCBcIndoZW5Ob3RBY3RpdmVcIiB8IFwibmV2ZXJcIj5cbiAgcmVzdWx0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcm90YXRlOiBBY2Nlc3NhYmxlPE51bWJlckxpa2UgfCBcImF1dG9cIiB8IFwiYXV0by1yZXZlcnNlXCI+XG4gIHJ4OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHJ5OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHNjYWxlOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHNlZWQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJzaGFwZS1yZW5kZXJpbmdcIjogQWNjZXNzYWJsZTxcbiAgICBcImF1dG9cIiB8IFwib3B0aW1pemVTcGVlZFwiIHwgXCJjcmlzcEVkZ2VzXCIgfCBcImdlb21ldHJpY1ByZWNpc2lvblwiXG4gID5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHNsb3BlOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHNwYWNpbmc6IEFjY2Vzc2FibGU8XCJhdXRvXCIgfCBcImV4YWN0XCI+XG4gIHNwZWN1bGFyQ29uc3RhbnQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3BlY3VsYXJFeHBvbmVudDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzcGVlZDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzcHJlYWRNZXRob2Q6IEFjY2Vzc2FibGU8XCJwYWRcIiB8IFwicmVmbGVjdFwiIHwgXCJyZXBlYXRcIj5cbiAgc3RhcnRPZmZzZXQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3RkRGV2aWF0aW9uOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzdGVtaDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc3RlbXY6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3RpdGNoVGlsZXM6IEFjY2Vzc2FibGU8XCJub1N0aXRjaFwiIHwgXCJzdGl0Y2hcIj5cbiAgXCJzdG9wLWNvbG9yXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcInN0b3Atb3BhY2l0eVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwic3RyaWtldGhyb3VnaC1wb3NpdGlvblwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwic3RyaWtldGhyb3VnaC10aGlja25lc3NcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc3RyaW5nOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHN0cm9rZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIFwic3Ryb2tlLWRhc2hhcnJheVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwic3Ryb2tlLWRhc2hvZmZzZXRcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInN0cm9rZS1saW5lY2FwXCI6IEFjY2Vzc2FibGU8XCJidXR0XCIgfCBcInJvdW5kXCIgfCBcInNxdWFyZVwiIHwgXCJpbmhlcml0XCI+XG4gIFwic3Ryb2tlLWxpbmVqb2luXCI6IEFjY2Vzc2FibGU8XCJtaXRlclwiIHwgXCJyb3VuZFwiIHwgXCJiZXZlbFwiIHwgXCJpbmhlcml0XCI+XG4gIFwic3Ryb2tlLW1pdGVybGltaXRcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInN0cm9rZS1vcGFjaXR5XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJzdHJva2Utd2lkdGhcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzdXJmYWNlU2NhbGU6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3lzdGVtTGFuZ3VhZ2U6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdGFibGVWYWx1ZXM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdGFyZ2V0WDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB0YXJnZXRZOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwidGV4dC1hbmNob3JcIjogQWNjZXNzYWJsZTxcInN0YXJ0XCIgfCBcIm1pZGRsZVwiIHwgXCJlbmRcIj5cbiAgXCJ0ZXh0LWRlY29yYXRpb25cIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRleHRMZW5ndGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJ0ZXh0LXJlbmRlcmluZ1wiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHRvOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHRyYW5zZm9ybTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIFwidHJhbnNmb3JtLW9yaWdpblwiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdHlwZTogQWNjZXNzYWJsZTxcbiAgICB8IFwidHJhbnNsYXRlXCJcbiAgICB8IFwic2NhbGVcIlxuICAgIHwgXCJyb3RhdGVcIlxuICAgIHwgXCJza2V3WFwiXG4gICAgfCBcInNrZXdZXCJcbiAgICB8IFwibWF0cml4XCJcbiAgICB8IFwic2F0dXJhdGVcIlxuICAgIHwgXCJodWVSb3RhdGVcIlxuICAgIHwgXCJsdW1pbmFuY2VUb0FscGhhXCJcbiAgICB8IFwiaWRlbnRpdHlcIlxuICAgIHwgXCJ0YWJsZVwiXG4gICAgfCBcImRpc2NyZXRlXCJcbiAgICB8IFwibGluZWFyXCJcbiAgICB8IFwiZ2FtbWFcIlxuICAgIHwgXCJmcmFjdGFsTm9pc2VcIlxuICAgIHwgXCJ0dXJidWxlbmNlXCJcbiAgPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdTE6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdTI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcInVuZGVybGluZS1wb3NpdGlvblwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwidW5kZXJsaW5lLXRoaWNrbmVzc1wiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB1bmljb2RlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJ1bmljb2RlLWJpZGlcIjogQWNjZXNzYWJsZTxcbiAgICB8IFwibm9ybWFsXCJcbiAgICB8IFwiZW1iZWRcIlxuICAgIHwgXCJpc29sYXRlXCJcbiAgICB8IFwiYmlkaS1vdmVycmlkZVwiXG4gICAgfCBcImlzb2xhdGUtb3ZlcnJpZGVcIlxuICAgIHwgXCJwbGFpbnRleHRcIlxuICA+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInVuaWNvZGUtcmFuZ2VcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInVuaXRzLXBlci1lbVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInYtYWxwaGFiZXRpY1wiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHZhbHVlczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIFwidmVjdG9yLWVmZmVjdFwiOiBBY2Nlc3NhYmxlPFxuICAgIHwgXCJub25lXCJcbiAgICB8IFwibm9uLXNjYWxpbmctc3Ryb2tlXCJcbiAgICB8IFwibm9uLXNjYWxpbmctc2l6ZVwiXG4gICAgfCBcIm5vbi1yb3RhdGlvblwiXG4gICAgfCBcImZpeGVkLXBvc2l0aW9uXCJcbiAgPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdmVyc2lvbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInZlcnQtYWR2LXlcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ2ZXJ0LW9yaWdpbi14XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwidmVydC1vcmlnaW4teVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInYtaGFuZ2luZ1wiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInYtaWRlb2dyYXBoaWNcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB2aWV3Qm94OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZpZXdUYXJnZXQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdmlzaWJpbGl0eTogQWNjZXNzYWJsZTxcInZpc2libGVcIiB8IFwiaGlkZGVuXCIgfCBcImNvbGxhcHNlXCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInYtbWF0aGVtYXRpY2FsXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHdpZHRoczogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcIndvcmQtc3BhY2luZ1wiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwid3JpdGluZy1tb2RlXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgeDE6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgeDI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgeDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB4Q2hhbm5lbFNlbGVjdG9yOiBBY2Nlc3NhYmxlPFwiUlwiIHwgXCJHXCIgfCBcIkJcIiB8IFwiQVwiPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4LWhlaWdodFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhsaW5rOmFjdHVhdGVcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhsaW5rOmFyY3JvbGVcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhsaW5rOmhyZWZcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhsaW5rOnJvbGVcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhsaW5rOnNob3dcIjogQWNjZXNzYWJsZTxcIm5ld1wiIHwgXCJyZXBsYWNlXCIgfCBcImVtYmVkXCIgfCBcIm90aGVyXCIgfCBcIm5vbmVcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwieGxpbms6dGl0bGVcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhsaW5rOnR5cGVcIjogQWNjZXNzYWJsZTxcInNpbXBsZVwiPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4bWw6YmFzZVwiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJ4bWw6bGFuZ1wiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwieG1sOnNwYWNlXCI6IEFjY2Vzc2FibGU8XCJkZWZhdWx0XCIgfCBcInByZXNlcnZlXCI+XG4gIHkxOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHkyOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHk6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgeUNoYW5uZWxTZWxlY3RvcjogQWNjZXNzYWJsZTxcIlJcIiB8IFwiR1wiIHwgXCJCXCIgfCBcIkFcIj5cbiAgejogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgem9vbUFuZFBhbjogQWNjZXNzYWJsZTxcImRpc2FibGVcIiB8IFwibWFnbmlmeVwiPlxufVxuaW50ZXJmYWNlIFN0eWxlcyB7XG4gIGFjY2VudENvbG9yPzogc3RyaW5nXG4gIGFsaWduQ29udGVudD86IHN0cmluZ1xuICBhbGlnbkl0ZW1zPzogc3RyaW5nXG4gIGFsaWduU2VsZj86IHN0cmluZ1xuICBhbGlnbm1lbnRCYXNlbGluZT86IHN0cmluZ1xuICBhbGw/OiBzdHJpbmdcbiAgYW5pbWF0aW9uPzogc3RyaW5nXG4gIGFuaW1hdGlvbkRlbGF5Pzogc3RyaW5nXG4gIGFuaW1hdGlvbkRpcmVjdGlvbj86IHN0cmluZ1xuICBhbmltYXRpb25EdXJhdGlvbj86IHN0cmluZ1xuICBhbmltYXRpb25GaWxsTW9kZT86IHN0cmluZ1xuICBhbmltYXRpb25JdGVyYXRpb25Db3VudD86IHN0cmluZ1xuICBhbmltYXRpb25OYW1lPzogc3RyaW5nXG4gIGFuaW1hdGlvblBsYXlTdGF0ZT86IHN0cmluZ1xuICBhbmltYXRpb25UaW1pbmdGdW5jdGlvbj86IHN0cmluZ1xuICBhcHBlYXJhbmNlPzogc3RyaW5nXG4gIGFzcGVjdFJhdGlvPzogc3RyaW5nXG4gIGJhY2tmYWNlVmlzaWJpbGl0eT86IHN0cmluZ1xuICBiYWNrZ3JvdW5kPzogc3RyaW5nXG4gIGJhY2tncm91bmRBdHRhY2htZW50Pzogc3RyaW5nXG4gIGJhY2tncm91bmRCbGVuZE1vZGU/OiBzdHJpbmdcbiAgYmFja2dyb3VuZENsaXA/OiBzdHJpbmdcbiAgYmFja2dyb3VuZENvbG9yPzogc3RyaW5nXG4gIGJhY2tncm91bmRJbWFnZT86IHN0cmluZ1xuICBiYWNrZ3JvdW5kT3JpZ2luPzogc3RyaW5nXG4gIGJhY2tncm91bmRQb3NpdGlvbj86IHN0cmluZ1xuICBiYWNrZ3JvdW5kUG9zaXRpb25YPzogc3RyaW5nXG4gIGJhY2tncm91bmRQb3NpdGlvblk/OiBzdHJpbmdcbiAgYmFja2dyb3VuZFJlcGVhdD86IHN0cmluZ1xuICBiYWNrZ3JvdW5kU2l6ZT86IHN0cmluZ1xuICBiYXNlbGluZVNoaWZ0Pzogc3RyaW5nXG4gIGJsb2NrU2l6ZT86IHN0cmluZ1xuICBib3JkZXI/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2s/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tDb2xvcj86IHN0cmluZ1xuICBib3JkZXJCbG9ja0VuZD86IHN0cmluZ1xuICBib3JkZXJCbG9ja0VuZENvbG9yPzogc3RyaW5nXG4gIGJvcmRlckJsb2NrRW5kU3R5bGU/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tFbmRXaWR0aD86IHN0cmluZ1xuICBib3JkZXJCbG9ja1N0YXJ0Pzogc3RyaW5nXG4gIGJvcmRlckJsb2NrU3RhcnRDb2xvcj86IHN0cmluZ1xuICBib3JkZXJCbG9ja1N0YXJ0U3R5bGU/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tTdGFydFdpZHRoPzogc3RyaW5nXG4gIGJvcmRlckJsb2NrU3R5bGU/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tXaWR0aD86IHN0cmluZ1xuICBib3JkZXJCb3R0b20/OiBzdHJpbmdcbiAgYm9yZGVyQm90dG9tQ29sb3I/OiBzdHJpbmdcbiAgYm9yZGVyQm90dG9tTGVmdFJhZGl1cz86IHN0cmluZ1xuICBib3JkZXJCb3R0b21SaWdodFJhZGl1cz86IHN0cmluZ1xuICBib3JkZXJCb3R0b21TdHlsZT86IHN0cmluZ1xuICBib3JkZXJCb3R0b21XaWR0aD86IHN0cmluZ1xuICBib3JkZXJDb2xsYXBzZT86IHN0cmluZ1xuICBib3JkZXJDb2xvcj86IHN0cmluZ1xuICBib3JkZXJFbmRFbmRSYWRpdXM/OiBzdHJpbmdcbiAgYm9yZGVyRW5kU3RhcnRSYWRpdXM/OiBzdHJpbmdcbiAgYm9yZGVySW1hZ2U/OiBzdHJpbmdcbiAgYm9yZGVySW1hZ2VPdXRzZXQ/OiBzdHJpbmdcbiAgYm9yZGVySW1hZ2VSZXBlYXQ/OiBzdHJpbmdcbiAgYm9yZGVySW1hZ2VTbGljZT86IHN0cmluZ1xuICBib3JkZXJJbWFnZVNvdXJjZT86IHN0cmluZ1xuICBib3JkZXJJbWFnZVdpZHRoPzogc3RyaW5nXG4gIGJvcmRlcklubGluZT86IHN0cmluZ1xuICBib3JkZXJJbmxpbmVDb2xvcj86IHN0cmluZ1xuICBib3JkZXJJbmxpbmVFbmQ/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lRW5kQ29sb3I/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lRW5kU3R5bGU/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lRW5kV2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lU3RhcnQ/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lU3RhcnRDb2xvcj86IHN0cmluZ1xuICBib3JkZXJJbmxpbmVTdGFydFN0eWxlPzogc3RyaW5nXG4gIGJvcmRlcklubGluZVN0YXJ0V2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lU3R5bGU/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lV2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVyTGVmdD86IHN0cmluZ1xuICBib3JkZXJMZWZ0Q29sb3I/OiBzdHJpbmdcbiAgYm9yZGVyTGVmdFN0eWxlPzogc3RyaW5nXG4gIGJvcmRlckxlZnRXaWR0aD86IHN0cmluZ1xuICBib3JkZXJSYWRpdXM/OiBzdHJpbmdcbiAgYm9yZGVyUmlnaHQ/OiBzdHJpbmdcbiAgYm9yZGVyUmlnaHRDb2xvcj86IHN0cmluZ1xuICBib3JkZXJSaWdodFN0eWxlPzogc3RyaW5nXG4gIGJvcmRlclJpZ2h0V2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVyU3BhY2luZz86IHN0cmluZ1xuICBib3JkZXJTdGFydEVuZFJhZGl1cz86IHN0cmluZ1xuICBib3JkZXJTdGFydFN0YXJ0UmFkaXVzPzogc3RyaW5nXG4gIGJvcmRlclN0eWxlPzogc3RyaW5nXG4gIGJvcmRlclRvcD86IHN0cmluZ1xuICBib3JkZXJUb3BDb2xvcj86IHN0cmluZ1xuICBib3JkZXJUb3BMZWZ0UmFkaXVzPzogc3RyaW5nXG4gIGJvcmRlclRvcFJpZ2h0UmFkaXVzPzogc3RyaW5nXG4gIGJvcmRlclRvcFN0eWxlPzogc3RyaW5nXG4gIGJvcmRlclRvcFdpZHRoPzogc3RyaW5nXG4gIGJvcmRlcldpZHRoPzogc3RyaW5nXG4gIGJvdHRvbT86IHN0cmluZ1xuICBib3hTaGFkb3c/OiBzdHJpbmdcbiAgYm94U2l6aW5nPzogc3RyaW5nXG4gIGJyZWFrQWZ0ZXI/OiBzdHJpbmdcbiAgYnJlYWtCZWZvcmU/OiBzdHJpbmdcbiAgYnJlYWtJbnNpZGU/OiBzdHJpbmdcbiAgY2FwdGlvblNpZGU/OiBzdHJpbmdcbiAgY2FyZXRDb2xvcj86IHN0cmluZ1xuICBjbGVhcj86IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2xpcD86IHN0cmluZ1xuICBjbGlwUGF0aD86IHN0cmluZ1xuICBjbGlwUnVsZT86IHN0cmluZ1xuICBjb2xvcj86IHN0cmluZ1xuICBjb2xvckludGVycG9sYXRpb24/OiBzdHJpbmdcbiAgY29sb3JJbnRlcnBvbGF0aW9uRmlsdGVycz86IHN0cmluZ1xuICBjb2xvclNjaGVtZT86IHN0cmluZ1xuICBjb2x1bW5Db3VudD86IHN0cmluZ1xuICBjb2x1bW5GaWxsPzogc3RyaW5nXG4gIGNvbHVtbkdhcD86IHN0cmluZ1xuICBjb2x1bW5SdWxlPzogc3RyaW5nXG4gIGNvbHVtblJ1bGVDb2xvcj86IHN0cmluZ1xuICBjb2x1bW5SdWxlU3R5bGU/OiBzdHJpbmdcbiAgY29sdW1uUnVsZVdpZHRoPzogc3RyaW5nXG4gIGNvbHVtblNwYW4/OiBzdHJpbmdcbiAgY29sdW1uV2lkdGg/OiBzdHJpbmdcbiAgY29sdW1ucz86IHN0cmluZ1xuICBjb250YWluPzogc3RyaW5nXG4gIGNvbnRlbnQ/OiBzdHJpbmdcbiAgY291bnRlckluY3JlbWVudD86IHN0cmluZ1xuICBjb3VudGVyUmVzZXQ/OiBzdHJpbmdcbiAgY291bnRlclNldD86IHN0cmluZ1xuICBjc3NGbG9hdD86IHN0cmluZ1xuICBjc3NUZXh0Pzogc3RyaW5nXG4gIGN1cnNvcj86IHN0cmluZ1xuICBkaXJlY3Rpb24/OiBzdHJpbmdcbiAgZGlzcGxheT86IHN0cmluZ1xuICBkb21pbmFudEJhc2VsaW5lPzogc3RyaW5nXG4gIGVtcHR5Q2VsbHM/OiBzdHJpbmdcbiAgZmlsbD86IHN0cmluZ1xuICBmaWxsT3BhY2l0eT86IHN0cmluZ1xuICBmaWxsUnVsZT86IHN0cmluZ1xuICBmaWx0ZXI/OiBzdHJpbmdcbiAgZmxleD86IHN0cmluZ1xuICBmbGV4QmFzaXM/OiBzdHJpbmdcbiAgZmxleERpcmVjdGlvbj86IHN0cmluZ1xuICBmbGV4Rmxvdz86IHN0cmluZ1xuICBmbGV4R3Jvdz86IHN0cmluZ1xuICBmbGV4U2hyaW5rPzogc3RyaW5nXG4gIGZsZXhXcmFwPzogc3RyaW5nXG4gIGZsb2F0Pzogc3RyaW5nXG4gIGZsb29kQ29sb3I/OiBzdHJpbmdcbiAgZmxvb2RPcGFjaXR5Pzogc3RyaW5nXG4gIGZvbnQ/OiBzdHJpbmdcbiAgZm9udEZhbWlseT86IHN0cmluZ1xuICBmb250RmVhdHVyZVNldHRpbmdzPzogc3RyaW5nXG4gIGZvbnRLZXJuaW5nPzogc3RyaW5nXG4gIGZvbnRPcHRpY2FsU2l6aW5nPzogc3RyaW5nXG4gIGZvbnRTaXplPzogc3RyaW5nXG4gIGZvbnRTaXplQWRqdXN0Pzogc3RyaW5nXG4gIGZvbnRTdHJldGNoPzogc3RyaW5nXG4gIGZvbnRTdHlsZT86IHN0cmluZ1xuICBmb250U3ludGhlc2lzPzogc3RyaW5nXG4gIGZvbnRWYXJpYW50Pzogc3RyaW5nXG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBmb250VmFyaWFudEFsdGVybmF0ZXM/OiBzdHJpbmdcbiAgZm9udFZhcmlhbnRDYXBzPzogc3RyaW5nXG4gIGZvbnRWYXJpYW50RWFzdEFzaWFuPzogc3RyaW5nXG4gIGZvbnRWYXJpYW50TGlnYXR1cmVzPzogc3RyaW5nXG4gIGZvbnRWYXJpYW50TnVtZXJpYz86IHN0cmluZ1xuICBmb250VmFyaWFudFBvc2l0aW9uPzogc3RyaW5nXG4gIGZvbnRWYXJpYXRpb25TZXR0aW5ncz86IHN0cmluZ1xuICBmb250V2VpZ2h0Pzogc3RyaW5nXG4gIGdhcD86IHN0cmluZ1xuICBncmlkPzogc3RyaW5nXG4gIGdyaWRBcmVhPzogc3RyaW5nXG4gIGdyaWRBdXRvQ29sdW1ucz86IHN0cmluZ1xuICBncmlkQXV0b0Zsb3c/OiBzdHJpbmdcbiAgZ3JpZEF1dG9Sb3dzPzogc3RyaW5nXG4gIGdyaWRDb2x1bW4/OiBzdHJpbmdcbiAgZ3JpZENvbHVtbkVuZD86IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZ3JpZENvbHVtbkdhcD86IHN0cmluZ1xuICBncmlkQ29sdW1uU3RhcnQ/OiBzdHJpbmdcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGdyaWRHYXA/OiBzdHJpbmdcbiAgZ3JpZFJvdz86IHN0cmluZ1xuICBncmlkUm93RW5kPzogc3RyaW5nXG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBncmlkUm93R2FwPzogc3RyaW5nXG4gIGdyaWRSb3dTdGFydD86IHN0cmluZ1xuICBncmlkVGVtcGxhdGU/OiBzdHJpbmdcbiAgZ3JpZFRlbXBsYXRlQXJlYXM/OiBzdHJpbmdcbiAgZ3JpZFRlbXBsYXRlQ29sdW1ucz86IHN0cmluZ1xuICBncmlkVGVtcGxhdGVSb3dzPzogc3RyaW5nXG4gIGhlaWdodD86IHN0cmluZ1xuICBoeXBoZW5zPzogc3RyaW5nXG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBpbWFnZU9yaWVudGF0aW9uPzogc3RyaW5nXG4gIGltYWdlUmVuZGVyaW5nPzogc3RyaW5nXG4gIGlubGluZVNpemU/OiBzdHJpbmdcbiAgaW5zZXQ/OiBzdHJpbmdcbiAgaW5zZXRCbG9jaz86IHN0cmluZ1xuICBpbnNldEJsb2NrRW5kPzogc3RyaW5nXG4gIGluc2V0QmxvY2tTdGFydD86IHN0cmluZ1xuICBpbnNldElubGluZT86IHN0cmluZ1xuICBpbnNldElubGluZUVuZD86IHN0cmluZ1xuICBpbnNldElubGluZVN0YXJ0Pzogc3RyaW5nXG4gIGlzb2xhdGlvbj86IHN0cmluZ1xuICBqdXN0aWZ5Q29udGVudD86IHN0cmluZ1xuICBqdXN0aWZ5SXRlbXM/OiBzdHJpbmdcbiAganVzdGlmeVNlbGY/OiBzdHJpbmdcbiAgbGVmdD86IHN0cmluZ1xuICBsZXR0ZXJTcGFjaW5nPzogc3RyaW5nXG4gIGxpZ2h0aW5nQ29sb3I/OiBzdHJpbmdcbiAgbGluZUJyZWFrPzogc3RyaW5nXG4gIGxpbmVIZWlnaHQ/OiBzdHJpbmdcbiAgbGlzdFN0eWxlPzogc3RyaW5nXG4gIGxpc3RTdHlsZUltYWdlPzogc3RyaW5nXG4gIGxpc3RTdHlsZVBvc2l0aW9uPzogc3RyaW5nXG4gIGxpc3RTdHlsZVR5cGU/OiBzdHJpbmdcbiAgbWFyZ2luPzogc3RyaW5nXG4gIG1hcmdpbkJsb2NrPzogc3RyaW5nXG4gIG1hcmdpbkJsb2NrRW5kPzogc3RyaW5nXG4gIG1hcmdpbkJsb2NrU3RhcnQ/OiBzdHJpbmdcbiAgbWFyZ2luQm90dG9tPzogc3RyaW5nXG4gIG1hcmdpbklubGluZT86IHN0cmluZ1xuICBtYXJnaW5JbmxpbmVFbmQ/OiBzdHJpbmdcbiAgbWFyZ2luSW5saW5lU3RhcnQ/OiBzdHJpbmdcbiAgbWFyZ2luTGVmdD86IHN0cmluZ1xuICBtYXJnaW5SaWdodD86IHN0cmluZ1xuICBtYXJnaW5Ub3A/OiBzdHJpbmdcbiAgbWFya2VyPzogc3RyaW5nXG4gIG1hcmtlckVuZD86IHN0cmluZ1xuICBtYXJrZXJNaWQ/OiBzdHJpbmdcbiAgbWFya2VyU3RhcnQ/OiBzdHJpbmdcbiAgbWFzaz86IHN0cmluZ1xuICBtYXNrVHlwZT86IHN0cmluZ1xuICBtYXhCbG9ja1NpemU/OiBzdHJpbmdcbiAgbWF4SGVpZ2h0Pzogc3RyaW5nXG4gIG1heElubGluZVNpemU/OiBzdHJpbmdcbiAgbWF4V2lkdGg/OiBzdHJpbmdcbiAgbWluQmxvY2tTaXplPzogc3RyaW5nXG4gIG1pbkhlaWdodD86IHN0cmluZ1xuICBtaW5JbmxpbmVTaXplPzogc3RyaW5nXG4gIG1pbldpZHRoPzogc3RyaW5nXG4gIG1peEJsZW5kTW9kZT86IHN0cmluZ1xuICBvYmplY3RGaXQ/OiBzdHJpbmdcbiAgb2JqZWN0UG9zaXRpb24/OiBzdHJpbmdcbiAgb2Zmc2V0Pzogc3RyaW5nXG4gIG9mZnNldEFuY2hvcj86IHN0cmluZ1xuICBvZmZzZXREaXN0YW5jZT86IHN0cmluZ1xuICBvZmZzZXRQYXRoPzogc3RyaW5nXG4gIG9mZnNldFJvdGF0ZT86IHN0cmluZ1xuICBvcGFjaXR5Pzogc3RyaW5nXG4gIG9yZGVyPzogc3RyaW5nXG4gIG9ycGhhbnM/OiBzdHJpbmdcbiAgb3V0bGluZT86IHN0cmluZ1xuICBvdXRsaW5lQ29sb3I/OiBzdHJpbmdcbiAgb3V0bGluZU9mZnNldD86IHN0cmluZ1xuICBvdXRsaW5lU3R5bGU/OiBzdHJpbmdcbiAgb3V0bGluZVdpZHRoPzogc3RyaW5nXG4gIG92ZXJmbG93Pzogc3RyaW5nXG4gIG92ZXJmbG93QW5jaG9yPzogc3RyaW5nXG4gIG92ZXJmbG93V3JhcD86IHN0cmluZ1xuICBvdmVyZmxvd1g/OiBzdHJpbmdcbiAgb3ZlcmZsb3dZPzogc3RyaW5nXG4gIG92ZXJzY3JvbGxCZWhhdmlvcj86IHN0cmluZ1xuICBvdmVyc2Nyb2xsQmVoYXZpb3JCbG9jaz86IHN0cmluZ1xuICBvdmVyc2Nyb2xsQmVoYXZpb3JJbmxpbmU/OiBzdHJpbmdcbiAgb3ZlcnNjcm9sbEJlaGF2aW9yWD86IHN0cmluZ1xuICBvdmVyc2Nyb2xsQmVoYXZpb3JZPzogc3RyaW5nXG4gIHBhZGRpbmc/OiBzdHJpbmdcbiAgcGFkZGluZ0Jsb2NrPzogc3RyaW5nXG4gIHBhZGRpbmdCbG9ja0VuZD86IHN0cmluZ1xuICBwYWRkaW5nQmxvY2tTdGFydD86IHN0cmluZ1xuICBwYWRkaW5nQm90dG9tPzogc3RyaW5nXG4gIHBhZGRpbmdJbmxpbmU/OiBzdHJpbmdcbiAgcGFkZGluZ0lubGluZUVuZD86IHN0cmluZ1xuICBwYWRkaW5nSW5saW5lU3RhcnQ/OiBzdHJpbmdcbiAgcGFkZGluZ0xlZnQ/OiBzdHJpbmdcbiAgcGFkZGluZ1JpZ2h0Pzogc3RyaW5nXG4gIHBhZGRpbmdUb3A/OiBzdHJpbmdcbiAgcGFnZUJyZWFrQWZ0ZXI/OiBzdHJpbmdcbiAgcGFnZUJyZWFrQmVmb3JlPzogc3RyaW5nXG4gIHBhZ2VCcmVha0luc2lkZT86IHN0cmluZ1xuICBwYWludE9yZGVyPzogc3RyaW5nXG4gIHBlcnNwZWN0aXZlPzogc3RyaW5nXG4gIHBlcnNwZWN0aXZlT3JpZ2luPzogc3RyaW5nXG4gIHBsYWNlQ29udGVudD86IHN0cmluZ1xuICBwbGFjZUl0ZW1zPzogc3RyaW5nXG4gIHBsYWNlU2VsZj86IHN0cmluZ1xuICBwb2ludGVyRXZlbnRzPzogc3RyaW5nXG4gIHBvc2l0aW9uPzogc3RyaW5nXG4gIHF1b3Rlcz86IHN0cmluZ1xuICByZXNpemU/OiBzdHJpbmdcbiAgcmlnaHQ/OiBzdHJpbmdcbiAgcm90YXRlPzogc3RyaW5nXG4gIHJvd0dhcD86IHN0cmluZ1xuICBydWJ5UG9zaXRpb24/OiBzdHJpbmdcbiAgc2NhbGU/OiBzdHJpbmdcbiAgc2Nyb2xsQmVoYXZpb3I/OiBzdHJpbmdcbiAgc2Nyb2xsTWFyZ2luPzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbkJsb2NrPzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbkJsb2NrRW5kPzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbkJsb2NrU3RhcnQ/OiBzdHJpbmdcbiAgc2Nyb2xsTWFyZ2luQm90dG9tPzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbklubGluZT86IHN0cmluZ1xuICBzY3JvbGxNYXJnaW5JbmxpbmVFbmQ/OiBzdHJpbmdcbiAgc2Nyb2xsTWFyZ2luSW5saW5lU3RhcnQ/OiBzdHJpbmdcbiAgc2Nyb2xsTWFyZ2luTGVmdD86IHN0cmluZ1xuICBzY3JvbGxNYXJnaW5SaWdodD86IHN0cmluZ1xuICBzY3JvbGxNYXJnaW5Ub3A/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZz86IHN0cmluZ1xuICBzY3JvbGxQYWRkaW5nQmxvY2s/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZ0Jsb2NrRW5kPzogc3RyaW5nXG4gIHNjcm9sbFBhZGRpbmdCbG9ja1N0YXJ0Pzogc3RyaW5nXG4gIHNjcm9sbFBhZGRpbmdCb3R0b20/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZ0lubGluZT86IHN0cmluZ1xuICBzY3JvbGxQYWRkaW5nSW5saW5lRW5kPzogc3RyaW5nXG4gIHNjcm9sbFBhZGRpbmdJbmxpbmVTdGFydD86IHN0cmluZ1xuICBzY3JvbGxQYWRkaW5nTGVmdD86IHN0cmluZ1xuICBzY3JvbGxQYWRkaW5nUmlnaHQ/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZ1RvcD86IHN0cmluZ1xuICBzY3JvbGxTbmFwQWxpZ24/OiBzdHJpbmdcbiAgc2Nyb2xsU25hcFN0b3A/OiBzdHJpbmdcbiAgc2Nyb2xsU25hcFR5cGU/OiBzdHJpbmdcbiAgc2hhcGVJbWFnZVRocmVzaG9sZD86IHN0cmluZ1xuICBzaGFwZU1hcmdpbj86IHN0cmluZ1xuICBzaGFwZU91dHNpZGU/OiBzdHJpbmdcbiAgc2hhcGVSZW5kZXJpbmc/OiBzdHJpbmdcbiAgc3RvcENvbG9yPzogc3RyaW5nXG4gIHN0b3BPcGFjaXR5Pzogc3RyaW5nXG4gIHN0cm9rZT86IHN0cmluZ1xuICBzdHJva2VEYXNoYXJyYXk/OiBzdHJpbmdcbiAgc3Ryb2tlRGFzaG9mZnNldD86IHN0cmluZ1xuICBzdHJva2VMaW5lY2FwPzogc3RyaW5nXG4gIHN0cm9rZUxpbmVqb2luPzogc3RyaW5nXG4gIHN0cm9rZU1pdGVybGltaXQ/OiBzdHJpbmdcbiAgc3Ryb2tlT3BhY2l0eT86IHN0cmluZ1xuICBzdHJva2VXaWR0aD86IHN0cmluZ1xuICB0YWJTaXplPzogc3RyaW5nXG4gIHRhYmxlTGF5b3V0Pzogc3RyaW5nXG4gIHRleHRBbGlnbj86IHN0cmluZ1xuICB0ZXh0QWxpZ25MYXN0Pzogc3RyaW5nXG4gIHRleHRBbmNob3I/OiBzdHJpbmdcbiAgdGV4dENvbWJpbmVVcHJpZ2h0Pzogc3RyaW5nXG4gIHRleHREZWNvcmF0aW9uPzogc3RyaW5nXG4gIHRleHREZWNvcmF0aW9uQ29sb3I/OiBzdHJpbmdcbiAgdGV4dERlY29yYXRpb25MaW5lPzogc3RyaW5nXG4gIHRleHREZWNvcmF0aW9uU2tpcEluaz86IHN0cmluZ1xuICB0ZXh0RGVjb3JhdGlvblN0eWxlPzogc3RyaW5nXG4gIHRleHREZWNvcmF0aW9uVGhpY2tuZXNzPzogc3RyaW5nXG4gIHRleHRFbXBoYXNpcz86IHN0cmluZ1xuICB0ZXh0RW1waGFzaXNDb2xvcj86IHN0cmluZ1xuICB0ZXh0RW1waGFzaXNQb3NpdGlvbj86IHN0cmluZ1xuICB0ZXh0RW1waGFzaXNTdHlsZT86IHN0cmluZ1xuICB0ZXh0SW5kZW50Pzogc3RyaW5nXG4gIHRleHRPcmllbnRhdGlvbj86IHN0cmluZ1xuICB0ZXh0T3ZlcmZsb3c/OiBzdHJpbmdcbiAgdGV4dFJlbmRlcmluZz86IHN0cmluZ1xuICB0ZXh0U2hhZG93Pzogc3RyaW5nXG4gIHRleHRUcmFuc2Zvcm0/OiBzdHJpbmdcbiAgdGV4dFVuZGVybGluZU9mZnNldD86IHN0cmluZ1xuICB0ZXh0VW5kZXJsaW5lUG9zaXRpb24/OiBzdHJpbmdcbiAgdG9wPzogc3RyaW5nXG4gIHRvdWNoQWN0aW9uPzogc3RyaW5nXG4gIHRyYW5zZm9ybT86IHN0cmluZ1xuICB0cmFuc2Zvcm1Cb3g/OiBzdHJpbmdcbiAgdHJhbnNmb3JtT3JpZ2luPzogc3RyaW5nXG4gIHRyYW5zZm9ybVN0eWxlPzogc3RyaW5nXG4gIHRyYW5zaXRpb24/OiBzdHJpbmdcbiAgdHJhbnNpdGlvbkRlbGF5Pzogc3RyaW5nXG4gIHRyYW5zaXRpb25EdXJhdGlvbj86IHN0cmluZ1xuICB0cmFuc2l0aW9uUHJvcGVydHk/OiBzdHJpbmdcbiAgdHJhbnNpdGlvblRpbWluZ0Z1bmN0aW9uPzogc3RyaW5nXG4gIHRyYW5zbGF0ZT86IHN0cmluZ1xuICB1bmljb2RlQmlkaT86IHN0cmluZ1xuICB1c2VyU2VsZWN0Pzogc3RyaW5nXG4gIHZlcnRpY2FsQWxpZ24/OiBzdHJpbmdcbiAgdmlzaWJpbGl0eT86IHN0cmluZ1xuICB3aGl0ZVNwYWNlPzogc3RyaW5nXG4gIHdpZG93cz86IHN0cmluZ1xuICB3aWR0aD86IHN0cmluZ1xuICB3aWxsQ2hhbmdlPzogc3RyaW5nXG4gIHdvcmRCcmVhaz86IHN0cmluZ1xuICB3b3JkU3BhY2luZz86IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgd29yZFdyYXA/OiBzdHJpbmdcbiAgd3JpdGluZ01vZGU/OiBzdHJpbmdcbiAgekluZGV4Pzogc3RyaW5nXG4gIFtmaWVsZDogc3RyaW5nXTogc3RyaW5nIHwgdW5kZWZpbmVkXG59XG50eXBlIE9uUHJlZml4ZWRFdmVudEF0dHJpYnV0ZXM8VCwgRT4gPSB7XG4gIFtldmVudE5hbWU6IGBvbjoke3N0cmluZ31gXTogRXZlbnRIYW5kbGVyPFQsIEU+XG59XG5pbnRlcmZhY2UgRXZlbnRBdHRyaWJ1dGVzPFQ+IGV4dGVuZHMgT25QcmVmaXhlZEV2ZW50QXR0cmlidXRlczxULCBFdmVudD4ge1xuICBvbkFib3J0OiBFdmVudEhhbmRsZXI8VCwgVUlFdmVudD5cbiAgb25BbmltYXRpb25DYW5jZWw6IEV2ZW50SGFuZGxlcjxULCBBbmltYXRpb25FdmVudD5cbiAgb25BbmltYXRpb25FbmQ6IEV2ZW50SGFuZGxlcjxULCBBbmltYXRpb25FdmVudD5cbiAgb25BbmltYXRpb25JdGVyYXRpb246IEV2ZW50SGFuZGxlcjxULCBBbmltYXRpb25FdmVudD5cbiAgb25BbmltYXRpb25TdGFydDogRXZlbnRIYW5kbGVyPFQsIEFuaW1hdGlvbkV2ZW50PlxuICBvbkF1eENsaWNrOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25CZWZvcmVJbnB1dDogRXZlbnRIYW5kbGVyPFQsIElucHV0RXZlbnQ+XG4gIG9uQmx1cjogRXZlbnRIYW5kbGVyPFQsIEZvY3VzRXZlbnQ+XG4gIG9uQ2FuUGxheTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkNhblBsYXlUaHJvdWdoOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uQ2hhbmdlOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uQ2xpY2s6IEV2ZW50SGFuZGxlcjxULCBNb3VzZUV2ZW50PlxuICBvbkNsb3NlOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uQ29tcG9zaXRpb25FbmQ6IEV2ZW50SGFuZGxlcjxULCBDb21wb3NpdGlvbkV2ZW50PlxuICBvbkNvbXBvc2l0aW9uU3RhcnQ6IEV2ZW50SGFuZGxlcjxULCBDb21wb3NpdGlvbkV2ZW50PlxuICBvbkNvbXBvc2l0aW9uVXBkYXRlOiBFdmVudEhhbmRsZXI8VCwgQ29tcG9zaXRpb25FdmVudD5cbiAgb25Db250ZXh0TWVudTogRXZlbnRIYW5kbGVyPFQsIE1vdXNlRXZlbnQ+XG4gIG9uQ29weTogRXZlbnRIYW5kbGVyPFQsIENsaXBib2FyZEV2ZW50PlxuICBvbkN1ZUNoYW5nZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkN1dDogRXZlbnRIYW5kbGVyPFQsIENsaXBib2FyZEV2ZW50PlxuICBvbkRibENsaWNrOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25EcmFnOiBFdmVudEhhbmRsZXI8VCwgRHJhZ0V2ZW50PlxuICBvbkRyYWdFbmQ6IEV2ZW50SGFuZGxlcjxULCBEcmFnRXZlbnQ+XG4gIG9uRHJhZ0VudGVyOiBFdmVudEhhbmRsZXI8VCwgRHJhZ0V2ZW50PlxuICBvbkRyYWdMZWF2ZTogRXZlbnRIYW5kbGVyPFQsIERyYWdFdmVudD5cbiAgb25EcmFnT3ZlcjogRXZlbnRIYW5kbGVyPFQsIERyYWdFdmVudD5cbiAgb25EcmFnU3RhcnQ6IEV2ZW50SGFuZGxlcjxULCBEcmFnRXZlbnQ+XG4gIG9uRHJvcDogRXZlbnRIYW5kbGVyPFQsIERyYWdFdmVudD5cbiAgb25EdXJhdGlvbkNoYW5nZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkVtcHRpZWQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25FbmRlZDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkVycm9yOiBFdmVudEhhbmRsZXI8VCwgRXJyb3JFdmVudD5cbiAgb25Gb2N1czogRXZlbnRIYW5kbGVyPFQsIEZvY3VzRXZlbnQ+XG4gIG9uRm9jdXNJbjogRXZlbnRIYW5kbGVyPFQsIEZvY3VzRXZlbnQ+XG4gIG9uRm9jdXNPdXQ6IEV2ZW50SGFuZGxlcjxULCBGb2N1c0V2ZW50PlxuICBvbkZvcm1EYXRhOiBFdmVudEhhbmRsZXI8VCwgRm9ybURhdGFFdmVudD5cbiAgb25Hb3RQb2ludGVyQ2FwdHVyZTogRXZlbnRIYW5kbGVyPFQsIFBvaW50ZXJFdmVudD5cbiAgb25JbnB1dDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkludmFsaWQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25LZXlEb3duOiBFdmVudEhhbmRsZXI8VCwgS2V5Ym9hcmRFdmVudD5cbiAgb25LZXlQcmVzczogRXZlbnRIYW5kbGVyPFQsIEtleWJvYXJkRXZlbnQ+XG4gIG9uS2V5VXA6IEV2ZW50SGFuZGxlcjxULCBLZXlib2FyZEV2ZW50PlxuICBvbkxvYWQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25Mb2FkZWREYXRhOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uTG9hZGVkTWV0YWRhdGE6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25Mb2FkU3RhcnQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25Mb3N0UG9pbnRlckNhcHR1cmU6IEV2ZW50SGFuZGxlcjxULCBQb2ludGVyRXZlbnQ+XG4gIG9uTW91c2VEb3duOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25Nb3VzZUVudGVyOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25Nb3VzZUxlYXZlOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25Nb3VzZU1vdmU6IEV2ZW50SGFuZGxlcjxULCBNb3VzZUV2ZW50PlxuICBvbk1vdXNlT3V0OiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25Nb3VzZU92ZXI6IEV2ZW50SGFuZGxlcjxULCBNb3VzZUV2ZW50PlxuICBvbk1vdXNlVXA6IEV2ZW50SGFuZGxlcjxULCBNb3VzZUV2ZW50PlxuICBvblBhdXNlOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uUGFzdGU6IEV2ZW50SGFuZGxlcjxULCBDbGlwYm9hcmRFdmVudD5cbiAgb25QbGF5OiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uUGxheWluZzogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblBvaW50ZXJDYW5jZWw6IEV2ZW50SGFuZGxlcjxULCBQb2ludGVyRXZlbnQ+XG4gIG9uUG9pbnRlckRvd246IEV2ZW50SGFuZGxlcjxULCBQb2ludGVyRXZlbnQ+XG4gIG9uUG9pbnRlckVudGVyOiBFdmVudEhhbmRsZXI8VCwgUG9pbnRlckV2ZW50PlxuICBvblBvaW50ZXJMZWF2ZTogRXZlbnRIYW5kbGVyPFQsIFBvaW50ZXJFdmVudD5cbiAgb25Qb2ludGVyTW92ZTogRXZlbnRIYW5kbGVyPFQsIFBvaW50ZXJFdmVudD5cbiAgb25Qb2ludGVyT3V0OiBFdmVudEhhbmRsZXI8VCwgUG9pbnRlckV2ZW50PlxuICBvblBvaW50ZXJPdmVyOiBFdmVudEhhbmRsZXI8VCwgUG9pbnRlckV2ZW50PlxuICBvblBvaW50ZXJVcDogRXZlbnRIYW5kbGVyPFQsIFBvaW50ZXJFdmVudD5cbiAgb25Qcm9ncmVzczogRXZlbnRIYW5kbGVyPFQsIFByb2dyZXNzRXZlbnQ+XG4gIG9uUmF0ZUNoYW5nZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblJlc2V0OiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uUmVzaXplOiBFdmVudEhhbmRsZXI8VCwgVUlFdmVudD5cbiAgb25TY3JvbGw6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25TZWN1cml0eVBvbGljeVZpb2xhdGlvbjogRXZlbnRIYW5kbGVyPFxuICAgIFQsXG4gICAgU2VjdXJpdHlQb2xpY3lWaW9sYXRpb25FdmVudFxuICA+XG4gIG9uU2Vla2VkOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uU2Vla2luZzogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblNlbGVjdDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblNlbGVjdGlvbkNoYW5nZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblNlbGVjdFN0YXJ0OiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uU3RhbGxlZDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblN1Ym1pdDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblN1c3BlbmQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25UaW1lVXBkYXRlOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uVG9nZ2xlOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uVG91Y2hDYW5jZWw6IEV2ZW50SGFuZGxlcjxULCBUb3VjaEV2ZW50PlxuICBvblRvdWNoRW5kOiBFdmVudEhhbmRsZXI8VCwgVG91Y2hFdmVudD5cbiAgb25Ub3VjaE1vdmU6IEV2ZW50SGFuZGxlcjxULCBUb3VjaEV2ZW50PlxuICBvblRvdWNoU3RhcnQ6IEV2ZW50SGFuZGxlcjxULCBUb3VjaEV2ZW50PlxuICBvblRyYW5zaXRpb25DYW5jZWw6IEV2ZW50SGFuZGxlcjxULCBUcmFuc2l0aW9uRXZlbnQ+XG4gIG9uVHJhbnNpdGlvbkVuZDogRXZlbnRIYW5kbGVyPFQsIFRyYW5zaXRpb25FdmVudD5cbiAgb25UcmFuc2l0aW9uUnVuOiBFdmVudEhhbmRsZXI8VCwgVHJhbnNpdGlvbkV2ZW50PlxuICBvblRyYW5zaXRpb25TdGFydDogRXZlbnRIYW5kbGVyPFQsIFRyYW5zaXRpb25FdmVudD5cbiAgb25Wb2x1bWVDaGFuZ2U6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25XYWl0aW5nOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uV2Via2l0QW5pbWF0aW9uRW5kOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uV2Via2l0QW5pbWF0aW9uSXRlcmF0aW9uOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uV2Via2l0QW5pbWF0aW9uU3RhcnQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25XZWJraXRUcmFuc2l0aW9uRW5kOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uV2hlZWw6IEV2ZW50SGFuZGxlcjxULCBXaGVlbEV2ZW50PlxufVxuIiwiaW1wb3J0IHsgZWZmZWN0LCBzY29wZWQsIHNpZ25hbCB9IGZyb20gXCIuLi9kZXBzLnRzXCJcblxuY29uc3QgZ2xvYmFsU291cmNlcyA9IGF3YWl0IGdldEdsb2JhbFNvdXJjZXMoKVxuZXhwb3J0IGNvbnN0IGxvY2FsU291cmNlcyA9IHNpZ25hbDxTb3VyY2VbXT4oZ2V0TG9jYWxTb3VyY2VzKCkpXG5cbmNvbnN0IHNvdXJjZXMgPSBzY29wZWQoKCkgPT4ge1xuICBjb25zdCBzb3VyY2VzID0gKCkgPT4gWy4uLmdsb2JhbFNvdXJjZXMsIC4uLmxvY2FsU291cmNlcygpXVxuICBlZmZlY3QoKGluaXQpID0+IHtcbiAgICBjb25zdCBzb3VyY2VzID0gbG9jYWxTb3VyY2VzKClcbiAgICBpZiAoaW5pdCA9PT0gdHJ1ZSkgcmV0dXJuIGZhbHNlXG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJzb3VyY2VzXCIsIEpTT04uc3RyaW5naWZ5KHNvdXJjZXMpKVxuICB9LCB0cnVlKVxuICByZXR1cm4gc291cmNlc1xufSkhXG5cbmV4cG9ydCB0eXBlIFNvdXJjZSA9IHtcbiAgbmFtZTogc3RyaW5nXG4gIHVybDogc3RyaW5nXG59XG5cbmZ1bmN0aW9uIGdldExvY2FsU291cmNlcygpOiBTb3VyY2VbXSB7XG4gIGNvbnN0IGluaXRTb3VyY2VzID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJzb3VyY2VzXCIpIHx8IFwiW11cIlxuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGluaXRTb3VyY2VzKVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW11cbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiBnZXRHbG9iYWxTb3VyY2VzKCk6IFByb21pc2U8U291cmNlW10+IHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gYXdhaXQgKGF3YWl0IGZldGNoKFwiLi9zb3VyY2VzLmpzb25cIikpLmpzb24oKVxuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW11cbiAgfVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0U291cmNlcygpOiBTb3VyY2VbXSB7XG4gIHJldHVybiBzb3VyY2VzKClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGZpbmQodXJsOiBzdHJpbmcpOiBTb3VyY2UgfCB1bmRlZmluZWQge1xuICByZXR1cm4gc291cmNlcygpLmZpbmQoKHNvdXJjZSkgPT4gc291cmNlLnVybCA9PT0gdXJsKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlyc3QoKTogU291cmNlIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIHNvdXJjZXMoKVswXVxufVxuXG50eXBlIENvbmZpZyA9IHtcbiAgdXJsOiBzdHJpbmdcbiAgbGltaXQ/OiBudW1iZXJcbiAgcGFnZT86IG51bWJlclxuICB0YWdzPzogc3RyaW5nW11cbn1cblxuZXhwb3J0IHR5cGUgQm9vcnUgPSB7XG4gIGlkOiBudW1iZXJcbiAgdGFnczogc3RyaW5nW11cbiAgZmlsZVVybDogc3RyaW5nXG4gIHByZXZpZXdVcmw6IHN0cmluZ1xufVxuXG50eXBlIEJvb3J1UmVzcG9uc2UgPSBCb29ydVBvc3RbXSB8IHsgcG9zdDogQm9vcnVQb3N0W10gfVxuXG5leHBvcnQgdHlwZSBCb29ydVBvc3QgPSB7XG4gIGlkOiBudW1iZXJcbiAgZmlsZV91cmw6IHN0cmluZ1xuICAvKiogZGFuYm9vcnUuZG9ubWFpLnVzIG9ubHkgKi9cbiAgdGFnX3N0cmluZzogc3RyaW5nXG4gIC8qKiB5YW5kZS5yZSAqL1xuICB0YWdzOiBzdHJpbmdcbiAgLyoqIHlhbmRlLnJlICovXG4gIHByZXZpZXdfdXJsOiBzdHJpbmdcbiAgLyoqIGRhbmJvb3J1LmRvbm1haS51cyAqL1xuICBwcmV2aWV3X2ZpbGVfdXJsOiBzdHJpbmdcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUJvb3J1KGNvbmZpZzogKCkgPT4gQ29uZmlnKSB7XG4gIGNvbnN0IHBvc3RzID0gc2lnbmFsPEJvb3J1W10+KFtdKVxuICBlZmZlY3QoYXN5bmMgKCkgPT4ge1xuICAgIGNvbnN0IHsgcGFnZSA9IDEsIGxpbWl0ID0gNDAsIHVybCwgdGFncyB9ID0gY29uZmlnKClcbiAgICBjb25zdCBpdGVtczogQm9vcnVbXSA9IFtdXG4gICAgY29uc3Qgc291cmNlID0gZmluZCh1cmwpPy51cmwgfHwgdXJsXG4gICAgaWYgKHNvdXJjZSkge1xuICAgICAgY29uc3QgYXBpID0gbmV3IFVSTChzb3VyY2UpXG4gICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKClcbiAgICAgIHBhcmFtcy5zZXQoXCJwYWdlXCIsIHBhZ2UudG9TdHJpbmcoKSlcbiAgICAgIHBhcmFtcy5zZXQoXCJsaW1pdFwiLCBsaW1pdC50b1N0cmluZygpKVxuICAgICAgaWYgKHRhZ3M/Lmxlbmd0aCkgcGFyYW1zLnNldChcInRhZ3NcIiwgdGFncy5qb2luKFwiIFwiKSlcbiAgICAgIGFwaS5zZWFyY2ggPSBwYXJhbXMudG9TdHJpbmcoKVxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChhcGkpXG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QganNvbjogQm9vcnVSZXNwb25zZSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKVxuICAgICAgICBmb3IgKGNvbnN0IHBvc3Qgb2YgKEFycmF5LmlzQXJyYXkoanNvbikgPyBqc29uIDoganNvbi5wb3N0KSB8fCBbXSkge1xuICAgICAgICAgIGlmIChwb3N0LmlkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChwb3N0LmZpbGVfdXJsID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHBvc3QucHJldmlld191cmwgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgcG9zdC5wcmV2aWV3X2ZpbGVfdXJsID09PSB1bmRlZmluZWRcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnRpbnVlXG4gICAgICAgICAgfVxuICAgICAgICAgIGl0ZW1zLnB1c2gobm9ybWFsaXplUG9zdChwb3N0KSlcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBwb3N0cyhpdGVtcylcbiAgfSlcbiAgcmV0dXJuIHBvc3RzXG59XG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZVBvc3QocG9zdDogQm9vcnVQb3N0KTogQm9vcnUge1xuICBjb25zdCBpdGVtOiBCb29ydSA9IHtcbiAgICBpZDogcG9zdC5pZCxcbiAgICBmaWxlVXJsOiBwb3N0LmZpbGVfdXJsLFxuICAgIHByZXZpZXdVcmw6IHBvc3QucHJldmlld191cmwgfHwgcG9zdC5wcmV2aWV3X2ZpbGVfdXJsLFxuICAgIHRhZ3M6IFtdLFxuICB9XG5cbiAgaWYgKChwb3N0LnRhZ3MgfHwgcG9zdC50YWdfc3RyaW5nKSkge1xuICAgIGl0ZW0udGFncyA9IChwb3N0LnRhZ3MgfHwgcG9zdC50YWdfc3RyaW5nKVxuICAgICAgLnNwbGl0KFwiIFwiKVxuICAgICAgLmZpbHRlcigodmFsdWUpID0+IHZhbHVlKVxuICB9XG5cbiAgcmV0dXJuIGl0ZW1cbn1cbiIsImltcG9ydCB7IGVmZmVjdCwgb25EZXN0cm95IH0gZnJvbSBcIi4uL2RlcHMudHNcIlxuXG5leHBvcnQgZnVuY3Rpb24gdXNlVGl0bGUodGl0bGU6ICgpID0+IHN0cmluZykge1xuICBjb25zdCBwcmV2aW91c1RpdGxlID0gZG9jdW1lbnQudGl0bGVcbiAgZWZmZWN0KCgpID0+IGRvY3VtZW50LnRpdGxlID0gdGl0bGUoKSlcbiAgb25EZXN0cm95KCgpID0+IGRvY3VtZW50LnRpdGxlID0gcHJldmlvdXNUaXRsZSlcbn1cbiIsImltcG9ydCB7IGNvbXB1dGVkLCBlZmZlY3QsIG9uLCBzY29wZWQsIHNpZ25hbCB9IGZyb20gXCIuL2RlcHMudHNcIlxuaW1wb3J0IHsgQm9vcnUsIGZpcnN0LCB1c2VCb29ydSB9IGZyb20gXCIuL2NvbXBvbmVudHMvdXNlLWJvb3J1LnRzXCJcbmltcG9ydCB7IHVzZVRpdGxlIH0gZnJvbSBcIi4vY29tcG9uZW50cy91c2UtdGl0bGUudHNcIlxuXG5jb25zdCBnZXRIYXNoID0gKCkgPT4ge1xuICBsZXQgaGFzaCA9IGxvY2F0aW9uLmhhc2hcbiAgaWYgKGhhc2guc3RhcnRzV2l0aChcIiNcIikpIGhhc2ggPSBoYXNoLnNsaWNlKDEpXG4gIHJldHVybiBoYXNoXG59XG5cbmNvbnN0IGdldFBhcmFtcyA9ICgpID0+IHtcbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcyhnZXRIYXNoKCkpXG4gIHJldHVybiB7XG4gICAgdXJsOiBwYXJhbXMuaGFzKFwidXJsXCIpID8gcGFyYW1zLmdldChcInVybFwiKSEgOiBmaXJzdCgpPy51cmwhLFxuICAgIHBhZ2U6IHBhcmFtcy5oYXMoXCJwYWdlXCIpID8gfn5wYXJhbXMuZ2V0KFwicGFnZVwiKSEgOiAxLFxuICAgIGxpbWl0OiBwYXJhbXMuaGFzKFwibGltaXRcIikgPyB+fnBhcmFtcy5nZXQoXCJsaW1pdFwiKSEgOiA0MCxcbiAgICBzZWFyY2g6IHBhcmFtcy5oYXMoXCJzZWFyY2hcIikgPyBwYXJhbXMuZ2V0KFwic2VhcmNoXCIpISA6IFwiXCIsXG4gICAgdGFnczogcGFyYW1zLmhhcyhcInRhZ3NcIilcbiAgICAgID8gcGFyYW1zLmdldChcInRhZ3NcIikhLnNwbGl0KFwiLFwiKS5maWx0ZXIoKHRhZykgPT4gdGFnKVxuICAgICAgOiBbXSxcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBzY29wZWQoKCkgPT4ge1xuICBjb25zdCBpbml0ID0gZ2V0UGFyYW1zKClcbiAgY29uc3QgdXJsID0gc2lnbmFsPHN0cmluZz4oaW5pdC51cmwpXG4gIGNvbnN0IGxpbWl0ID0gc2lnbmFsPG51bWJlcj4oaW5pdC5saW1pdClcbiAgY29uc3QgbG9hZGVkID0gc2lnbmFsKDApXG4gIGNvbnN0IHNpemUgPSBzaWduYWwoSW5maW5pdHkpXG4gIGNvbnN0IHNlYXJjaCA9IHNpZ25hbDxzdHJpbmc+KGluaXQuc2VhcmNoKVxuICBjb25zdCBoaWdobGlnaHRlZCA9IHNpZ25hbDxzdHJpbmdbXT4oW10pXG4gIGNvbnN0IHRhZ3MgPSBzaWduYWw8c3RyaW5nW10+KGluaXQudGFncylcbiAgY29uc3QgcGFnZSA9IHNpZ25hbChpbml0LnBhZ2UpXG4gIGNvbnN0IHNlbGVjdCA9IHNpZ25hbDxCb29ydT4oKVxuICBjb25zdCBwb3N0cyA9IHVzZUJvb3J1KCgpID0+IHtcbiAgICByZXR1cm4ge1xuICAgICAgdXJsOiB1cmwoKSxcbiAgICAgIGxpbWl0OiBsaW1pdCgpLFxuICAgICAgcGFnZTogcGFnZSgpLFxuICAgICAgdGFnczogdGFncygpLFxuICAgIH1cbiAgfSlcbiAgY29uc3QgcG9zdFRhZ3MgPSAoKSA9PiB7XG4gICAgY29uc3QgdGFnczogc3RyaW5nW10gPSBbXVxuICAgIGZvciAoY29uc3QgcG9zdCBvZiBwb3N0cygpKSB7XG4gICAgICBmb3IgKGNvbnN0IHRhZyBvZiBwb3N0LnRhZ3MpIHtcbiAgICAgICAgaWYgKHRhZ3MuaW5jbHVkZXModGFnKSA9PT0gZmFsc2UpIHRhZ3MucHVzaCh0YWcpXG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0YWdzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGlmIChhIDwgYikgcmV0dXJuIC0xXG4gICAgICBpZiAoYSA+IGIpIHJldHVybiAxXG4gICAgICByZXR1cm4gMFxuICAgIH0pXG4gIH1cbiAgY29uc3QgYWRkVGFnID0gKHRhZzogc3RyaW5nKSA9PiAhaGFzVGFnKHRhZykgJiYgdGFncyhbLi4udGFncygpLCB0YWddKVxuICBjb25zdCBkZWxUYWcgPSAodGFnOiBzdHJpbmcpID0+IHRhZ3ModGFncygpLmZpbHRlcigoJCkgPT4gJCAhPT0gdGFnKSlcbiAgY29uc3QgdG9nZ2xlVGFnID0gKHRhZzogc3RyaW5nKSA9PiBoYXNUYWcodGFnKSA/IGRlbFRhZyh0YWcpIDogYWRkVGFnKHRhZylcbiAgY29uc3QgaGFzVGFnID0gKHRhZzogc3RyaW5nKSA9PiB0YWdzKCkuaW5jbHVkZXModGFnKVxuICBjb25zdCBwYWdlUmVzZXRUcmlnZ2VyID0gKCkgPT4gKHVybCgpLCB0YWdzKCksIHVuZGVmaW5lZClcbiAgY29uc3Qgb25Qb3BTdGF0ZSA9ICgpID0+IHtcbiAgICBjb25zdCBwYXJhbXMgPSBnZXRQYXJhbXMoKVxuICAgIHVybChwYXJhbXMudXJsKVxuICAgIHBhZ2UocGFyYW1zLnBhZ2UpXG4gICAgbGltaXQocGFyYW1zLmxpbWl0KVxuICAgIHNlYXJjaChwYXJhbXMuc2VhcmNoKVxuICAgIHRhZ3MocGFyYW1zLnRhZ3MpXG4gIH1cblxuICBlZmZlY3QoXG4gICAgb24oc2VhcmNoLCAoY3VycmVudDogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiB7XG4gICAgICBpZiAoY3VycmVudCAhPT0gc2VhcmNoKCkpIHtcbiAgICAgICAgY29uc3QgdGFncyA9IHNlYXJjaCgpLnNwbGl0KFwiIFwiKS5maWx0ZXIoKHZhbHVlKSA9PiB2YWx1ZSlcbiAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgdGFncykgYWRkVGFnKHRhZylcbiAgICAgICAgcGFnZSgxKVxuICAgICAgfVxuICAgICAgcmV0dXJuIHNlYXJjaCgpXG4gICAgfSksXG4gICAgaW5pdC5zZWFyY2gsXG4gIClcblxuICB1c2VUaXRsZSgoKSA9PiB7XG4gICAgbGV0IHRpdGxlID0gYOODluODqeOCpuOCtu+8miR7cGFnZSgpfWBcbiAgICBpZiAodGFncygpLmxlbmd0aCkge1xuICAgICAgdGl0bGUgKz0gYCDjgIwke3RhZ3MoKS5qb2luKFwi44CBIFwiKX3jgI1gXG4gICAgfVxuICAgIHJldHVybiB0aXRsZVxuICB9KVxuXG4gIGVmZmVjdChvbihwb3N0cywgKCkgPT4ge1xuICAgIHNpemUocG9zdHMoKS5sZW5ndGgpXG4gICAgbG9hZGVkKDApXG4gIH0pKVxuXG4gIGVmZmVjdDxzdHJpbmcsIHN0cmluZz4oXG4gICAgb24ocGFnZVJlc2V0VHJpZ2dlciwgKGN1cnJlbnQpID0+IHtcbiAgICAgIGNvbnN0IG5leHQgPSBgJHt1cmwoKX0ke3RhZ3MoKS5qb2luKCl9YFxuICAgICAgaWYgKGN1cnJlbnQgIT09IG5leHQpIHBhZ2UoMSlcbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSksXG4gICAgYCR7dXJsKCl9JHt0YWdzKCkuam9pbigpfWAsXG4gIClcblxuICBlZmZlY3Q8VVJMU2VhcmNoUGFyYW1zLCBVUkxTZWFyY2hQYXJhbXM+KChwYXJhbXMpID0+IHtcbiAgICBpZiAocGFnZSgpID4gMSkgcGFyYW1zLnNldChcInBhZ2VcIiwgcGFnZSgpLnRvU3RyaW5nKCkpXG4gICAgZWxzZSBwYXJhbXMuZGVsZXRlKFwicGFnZVwiKVxuICAgIHBhcmFtcy5zZXQoXCJsaW1pdFwiLCBsaW1pdCgpLnRvU3RyaW5nKCkpXG4gICAgaWYgKHRhZ3MoKS5sZW5ndGgpIHBhcmFtcy5zZXQoXCJ0YWdzXCIsIHRhZ3MoKS5qb2luKFwiLFwiKSlcbiAgICBlbHNlIHBhcmFtcy5kZWxldGUoXCJ0YWdzXCIpXG4gICAgaWYgKHNlYXJjaCgpLmxlbmd0aCkgcGFyYW1zLnNldChcInNlYXJjaFwiLCBzZWFyY2goKSlcbiAgICBlbHNlIHBhcmFtcy5kZWxldGUoXCJzZWFyY2hcIilcbiAgICBwYXJhbXMuc2V0KFwidXJsXCIsIHVybCgpKVxuICAgIGxvY2F0aW9uLmhhc2ggPSBwYXJhbXMudG9TdHJpbmcoKVxuICAgIHJldHVybiBwYXJhbXNcbiAgfSwgbmV3IFVSTFNlYXJjaFBhcmFtcyhnZXRIYXNoKCkpKVxuXG4gIGFkZEV2ZW50TGlzdGVuZXIoXCJwb3BzdGF0ZVwiLCBvblBvcFN0YXRlKVxuXG4gIHJldHVybiB7XG4gICAgaGlnaGxpZ2h0ZWQsXG4gICAgdGFncyxcbiAgICBwb3N0cyxcbiAgICBwb3N0VGFncyxcbiAgICBwYWdlLFxuICAgIHNlbGVjdCxcbiAgICBhZGRUYWcsXG4gICAgZGVsVGFnLFxuICAgIGhhc1RhZyxcbiAgICB0b2dnbGVUYWcsXG4gICAgc2VhcmNoLFxuICAgIGxvYWRlZCxcbiAgICBzaXplLFxuICAgIGxpbWl0LFxuICAgIHVybCxcbiAgfVxufSkhXG4iLCJpbXBvcnQgeyBlZmZlY3QsIHNpZ25hbCB9IGZyb20gXCIuLi9kZXBzLnRzXCJcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZVdpa2kocXVlcnk6ICgpID0+IHN0cmluZyB8IHVuZGVmaW5lZCkge1xuICBjb25zdCBjYWNoZSA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmcgfCB1bmRlZmluZWQ+KClcbiAgY29uc3Qgd2lraSA9IHNpZ25hbDxzdHJpbmc+KClcbiAgZWZmZWN0KGFzeW5jICgpID0+IHtcbiAgICBjb25zdCB0aXRsZSA9IHF1ZXJ5KClcbiAgICBpZiAodGl0bGUpIHtcbiAgICAgIGlmIChjYWNoZS5oYXModGl0bGUpKSByZXR1cm4gd2lraShjYWNoZS5nZXQodGl0bGUpKVxuICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChgL2FwaS93aWtpLyR7dGl0bGV9YClcbiAgICAgIGlmIChyZXNwb25zZS5zdGF0dXMgPT09IDIwMCkge1xuICAgICAgICBjYWNoZS5zZXQodGl0bGUsIGF3YWl0IHJlc3BvbnNlLnRleHQoKSlcbiAgICAgICAgcmV0dXJuIHdpa2koY2FjaGUuZ2V0KHRpdGxlKSlcbiAgICAgIH1cbiAgICB9XG4gICAgd2lraSh1bmRlZmluZWQpXG4gIH0pXG4gIHJldHVybiB3aWtpXG59XG4iLCJpbXBvcnQgeyBlZmZlY3QsIG9uQ2xlYW51cCwgU2lnbmFsLCBzaWduYWwgfSBmcm9tIFwiLi4vZGVwcy50c1wiXG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VQZXJ2ZXJ0KCk6IFNpZ25hbDxib29sZWFuPiB7XG4gIGNvbnN0IGluaXQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcImlzOnBlcnZlcnRcIikgPT09IFwidHJ1ZVwiXG4gIGNvbnN0IGNvZGVzID0gXCJpbWFwZXJ2ZXJ0XCIuc3BsaXQoXCJcIilcbiAgY29uc3QgcGVydmVydCA9IHNpZ25hbChpbml0KVxuICBsZXQgaW5kZXggPSAwXG4gIGNvbnN0IG9uS2V5VXAgPSAoeyBrZXkgfTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgIGlmIChpbmRleCA9PT0gY29kZXMubGVuZ3RoIC0gMSkge1xuICAgICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oXCJpczpwZXJ2ZXJ0XCIsIFwidHJ1ZVwiKVxuICAgICAgcGVydmVydCh0cnVlKVxuICAgICAgcmV0dXJuXG4gICAgfVxuICAgIGlmIChcbiAgICAgIGtleSAhPSBudWxsICYmXG4gICAgICBjb2Rlc1tpbmRleF0gIT0gbnVsbCAmJlxuICAgICAga2V5LnRvTG93ZXJDYXNlKCkgPT09IGNvZGVzW2luZGV4XS50b0xvd2VyQ2FzZSgpXG4gICAgKSB7XG4gICAgICBpbmRleCsrXG4gICAgfSBlbHNlIHtcbiAgICAgIGluZGV4ID0gMFxuICAgICAgcGVydmVydChmYWxzZSlcbiAgICB9XG4gIH1cbiAgZWZmZWN0KCgpID0+IHtcbiAgICBvbkNsZWFudXAoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIG9uS2V5VXApKVxuICAgIGlmIChwZXJ2ZXJ0KCkpIHJldHVyblxuICAgIGFkZEV2ZW50TGlzdGVuZXIoXCJrZXl1cFwiLCBvbktleVVwKVxuICB9KVxuICByZXR1cm4gcGVydmVydFxufVxuIiwiaW50ZXJmYWNlIFJlYWRBc01hcCB7XG4gIHJlYWRBc0FycmF5QnVmZmVyOiBBcnJheUJ1ZmZlclxuICByZWFkQXNCaW5hcnlTdHJpbmc6IHN0cmluZ1xuICByZWFkQXNEYXRhVVJMOiBzdHJpbmdcbiAgcmVhZEFzVGV4dDogc3RyaW5nXG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGxvYWRGaWxlPFQgZXh0ZW5kcyBrZXlvZiBSZWFkQXNNYXA+KFxuICBhY2NlcHQ6IHN0cmluZyxcbiAgcmVhZEFzOiBULFxuKTogUHJvbWlzZTxSZWFkQXNNYXBbVF0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXMpID0+IHtcbiAgICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKVxuICAgIGlucHV0LnR5cGUgPSBcImZpbGVcIlxuICAgIGlucHV0LmFjY2VwdCA9IGFjY2VwdFxuICAgIGlucHV0Lm9uY2hhbmdlID0gKGV2KSA9PiB7XG4gICAgICBjb25zdCBmaWxlcyA9ICg8YW55PiBldi5jdXJyZW50VGFyZ2V0KS5maWxlc1xuICAgICAgaWYgKGZpbGVzID09PSBudWxsKSByZXR1cm5cbiAgICAgIGNvbnN0IHJlYWRlciA9IG5ldyBGaWxlUmVhZGVyKClcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlcyg8UmVhZEFzTWFwW1RdPiByZWFkZXIucmVzdWx0KVxuICAgICAgfVxuICAgICAgcmVhZGVyW3JlYWRBc10oZmlsZXNbMF0pXG4gICAgfVxuICAgIGlucHV0LmNsaWNrKClcbiAgfSlcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBkb3dubG9hZChuYW1lOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgZGF0YTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVuY29kZWQgPSBgJHt0eXBlfTtjaGFyc2V0PXV0Zi04LCR7ZW5jb2RlVVJJQ29tcG9uZW50KGRhdGEpfWBcbiAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJhXCIpXG4gIGEuaHJlZiA9IFwiZGF0YTpcIiArIGVuY29kZWRcbiAgYS5kb3dubG9hZCA9IG5hbWVcbiAgYS5jbGljaygpXG59XG4iLCJpbXBvcnQgQm9vcnUgZnJvbSBcIi4uL2NvbnRleHQudHNcIlxuaW1wb3J0IHtcbiAgYWRkRWxlbWVudCxcbiAgYXR0cmlidXRlc1JlZixcbiAgY29tcG9uZW50LFxuICBlbGVtZW50UmVmLFxuICBvbk1vdW50LFxuICBTaWduYWwsXG4gIHNpZ25hbCxcbiAgdmlldyxcbn0gZnJvbSBcIi4uL2RlcHMudHNcIlxuaW1wb3J0IHsgdXNlV2lraSB9IGZyb20gXCIuL3VzZS13aWtpLnRzXCJcbmltcG9ydCB7IGdldFNvdXJjZXMsIGxvY2FsU291cmNlcywgU291cmNlIH0gZnJvbSBcIi4vdXNlLWJvb3J1LnRzXCJcbmltcG9ydCB7IHVzZVBlcnZlcnQgfSBmcm9tIFwiLi91c2UtcGVydmVydC50c1wiXG5pbXBvcnQgeyB1cGxvYWRGaWxlIH0gZnJvbSBcIi4vdXBsb2FkLnRzXCJcbmltcG9ydCB7IGRvd25sb2FkIH0gZnJvbSBcIi4vZG93bmxvYWQudHNcIlxuXG5jb25zdCBOYXZpZ2F0aW9uID0gY29tcG9uZW50KCgpID0+IHtcbiAgY29uc3QgeyBwb3N0VGFncywgdGFncyB9ID0gQm9vcnVcbiAgY29uc3QgcXVlcnkgPSBzaWduYWw8c3RyaW5nPihcIlwiKVxuICBjb25zdCB3aWtpID0gdXNlV2lraShxdWVyeSlcbiAgY29uc3Qgc291cmNlRWRpdCA9IHNpZ25hbChmYWxzZSlcblxuICBhZGRFbGVtZW50KFwibmF2XCIsICgpID0+IHtcbiAgICBjb25zdCByZWYgPSBlbGVtZW50UmVmKCkhXG5cbiAgICB2aWV3KCgpID0+IHtcbiAgICAgIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIuY2xhc3MgPSBcImZsZXggYmctYWNjZW50LTIgYWxpZ24taXRlbXMtY2VudGVyIHN0aWNreS10b3BcIlxuICAgICAgICAgIGFkZEVsZW1lbnQoXCJoMlwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgICAgYXR0ci5jbGFzcyA9IFwiZmxleC0xIHBhZGRpbmctMTBcIlxuICAgICAgICAgICAgYXR0ci50ZXh0Q29udGVudCA9IFwic291cmNlIGVkaXRvclwiXG4gICAgICAgICAgfSlcblxuICAgICAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gZG93bmxvYWQtanNvblwiXG4gICAgICAgICAgICBhdHRyLnRpdGxlID0gXCJkb3dubG9hZCBzb3VyY2VzXCJcbiAgICAgICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHtcbiAgICAgICAgICAgICAgZG93bmxvYWQoXG4gICAgICAgICAgICAgICAgYHNvdXJjZXMtJHtEYXRlLm5vdygpfS5qc29uYCxcbiAgICAgICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgICAgICBKU09OLnN0cmluZ2lmeShsb2NhbFNvdXJjZXMoKSwgbnVsbCwgMiksXG4gICAgICAgICAgICAgIClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gY2xvc2VcIlxuICAgICAgICAgICAgYXR0ci50aXRsZSA9IFwiY2xvc2UgZWRpdG9yXCJcbiAgICAgICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHNvdXJjZUVkaXQoZmFsc2UpXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcblxuICAgICAgICBhdHRyLmNsYXNzID0gXCJzb3VyY2UtZWRpdG9yIHotaW5kZXgtMVwiXG4gICAgICAgIGF0dHIub3BlbiA9IHNvdXJjZUVkaXRcbiAgICAgICAgZm9yIChjb25zdCBzb3VyY2Ugb2YgbG9jYWxTb3VyY2VzKCkpIHtcbiAgICAgICAgICBTb3VyY2VFZGl0KHNvdXJjZSlcbiAgICAgICAgfVxuICAgICAgICBBZGRTb3VyY2UoKVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwibmF2LXRvcFwiXG4gICAgICBJbnB1dHMoc291cmNlRWRpdClcbiAgICAgIFBhZ2luZygpXG4gICAgICB2aWV3KCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgdGFncygpKSB7XG4gICAgICAgICAgYWRkRWxlbWVudChcImRpdlwiLCAoKSA9PiB0YWdBdHRyaWJ1dGVzKHRhZywgcXVlcnksIHdpa2kpKVxuICAgICAgICB9XG4gICAgICB9KVxuICAgIH0pXG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJ0YWdzXCJcbiAgICAgIHZpZXcoKCkgPT4ge1xuICAgICAgICBvbk1vdW50KCgpID0+IHJlZi5zY3JvbGxUbyh7IHRvcDogMCwgYmVoYXZpb3I6IFwic21vb3RoXCIgfSkpXG4gICAgICAgIGNvbnN0IHNlbFRhZ3MgPSB0YWdzKClcbiAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgcG9zdFRhZ3MoKS5maWx0ZXIoKHRhZykgPT4gIXNlbFRhZ3MuaW5jbHVkZXModGFnKSkpIHtcbiAgICAgICAgICBhZGRFbGVtZW50KFwiZGl2XCIsICgpID0+IHRhZ0F0dHJpYnV0ZXModGFnLCBxdWVyeSwgd2lraSkpXG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfSlcbiAgfSlcbn0pXG5cbmV4cG9ydCBkZWZhdWx0IE5hdmlnYXRpb25cblxuZnVuY3Rpb24gdGFnQXR0cmlidXRlcyhcbiAgdGFnOiBzdHJpbmcsXG4gIHF1ZXJ5OiBTaWduYWw8c3RyaW5nPixcbiAgd2lraTogU2lnbmFsPHN0cmluZyB8IHVuZGVmaW5lZD4sXG4pOiB2b2lkIHtcbiAgY29uc3QgeyB0b2dnbGVUYWcsIHRhZ3MsIGhpZ2hsaWdodGVkIH0gPSBCb29ydVxuICBjb25zdCBhdHRyID0gYXR0cmlidXRlc1JlZigpIVxuICBsZXQgbW91c2VJZDogbnVtYmVyXG4gIGF0dHIudGV4dENvbnRlbnQgPSB0YWdcbiAgYXR0ci5jbGFzcyA9IFwidGFnXCJcbiAgYXR0ci50aXRsZSA9ICgpID0+IHRhZyA9PT0gcXVlcnkoKSA/IHdpa2koKSB8fCB0YWcgOiB0YWdcbiAgYXR0ci5vbkNsaWNrID0gKCkgPT4gdG9nZ2xlVGFnKHRhZylcbiAgYXR0ci5vbk1vdXNlT3ZlciA9ICgpID0+IHtcbiAgICBjbGVhclRpbWVvdXQobW91c2VJZClcbiAgICBtb3VzZUlkID0gc2V0VGltZW91dCgoKSA9PiBxdWVyeSh0YWcpLCA1MDApXG4gIH1cbiAgYXR0ci5vbk1vdXNlT3V0ID0gKCkgPT4ge1xuICAgIGNsZWFyVGltZW91dChtb3VzZUlkKVxuICAgIHF1ZXJ5KHVuZGVmaW5lZClcbiAgfVxuICBhdHRyLnN0YXRlID0gKCkgPT4ge1xuICAgIGlmICh0YWdzKCkuaW5jbHVkZXModGFnKSkgcmV0dXJuIFwiYWN0aXZlXCJcbiAgICBlbHNlIGlmIChoaWdobGlnaHRlZCgpLmluY2x1ZGVzKHRhZykpIHJldHVybiBcImhpZ2hsaWdodFwiXG4gIH1cbn1cblxuY29uc3QgSW5wdXRzID0gY29tcG9uZW50KChzb3VyY2VFZGl0OiBTaWduYWw8Ym9vbGVhbj4pID0+IHtcbiAgY29uc3QgeyBzZWFyY2gsIHVybCB9ID0gQm9vcnVcbiAgY29uc3QgcGVydmVydCA9IHVzZVBlcnZlcnQoKVxuXG4gIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGFsaWduLWl0ZW1zLWNlbnRlclwiXG5cbiAgICB2aWV3KCgpID0+IHtcbiAgICAgIGlmIChwZXJ2ZXJ0KCkpIHtcbiAgICAgICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIudGl0bGUgPSBcImNob29zZSBpbWFnZSBzb3VyY2VcIlxuICAgICAgICAgIGF0dHIubmFtZSA9IFwic291cmNlXCJcbiAgICAgICAgICBhdHRyLnR5cGUgPSBcImJ1dHRvblwiXG4gICAgICAgICAgYXR0ci5jbGFzcyA9IFwiaWNvbiBzb3VyY2Ugei1pbmRleC0xXCJcbiAgICAgICAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICAgICAgICBhdHRyLmNsYXNzID0gXCJzb3VyY2VzXCJcbiAgICAgICAgICAgIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICAgICAgICAgICAgYXR0ci50aXRsZSA9IFwib3BlbiBzb3VyY2UgZWRpdG9yXCJcbiAgICAgICAgICAgICAgYXR0ci50ZXh0Q29udGVudCA9IFwic291cmNlIGVkaXRvclwiXG4gICAgICAgICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHNvdXJjZUVkaXQoIXNvdXJjZUVkaXQoKSlcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBnZXRTb3VyY2VzKCkpIHtcbiAgICAgICAgICAgICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgICAgICAgIGF0dHIuYWN0aXZlID0gKCkgPT4gc291cmNlLnVybCA9PT0gdXJsKClcbiAgICAgICAgICAgICAgICBhdHRyLnRleHRDb250ZW50ID0gc291cmNlLm5hbWVcbiAgICAgICAgICAgICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiB1cmwoc291cmNlLnVybClcbiAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pXG5cbiAgICBhZGRFbGVtZW50KFwiYnV0dG9uXCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLnRpdGxlID0gXCJicm93c2Ugc291cmNlXCJcbiAgICAgIGF0dHIubmFtZSA9IFwic291cmNlY29kZVwiXG4gICAgICBhdHRyLnR5cGUgPSBcImJ1dHRvblwiXG4gICAgICBhdHRyLmNsYXNzID0gXCJpY29uIHNvdXJjZWNvZGVcIlxuICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4ge1xuICAgICAgICBvcGVuKFwiaHR0cHM6Ly9naXRodWIuY29tL21pbmktamFpbC9idXJhdXphXCIsIFwiX2JsYW5rXCIpXG4gICAgICB9XG4gICAgfSlcblxuICAgIGFkZEVsZW1lbnQoXCJpbnB1dFwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwiZmxleC0xXCJcbiAgICAgIGF0dHIubmFtZSA9IFwic2VhcmNoXCJcbiAgICAgIGF0dHIucGxhY2Vob2xkZXIgPSBcInNlYXJjaC4uLlwiXG4gICAgICBhdHRyLnZhbHVlID0gc2VhcmNoXG4gICAgICBhdHRyLnR5cGUgPSBcInRleHRcIlxuICAgICAgbGV0IGlkOiBudW1iZXJcbiAgICAgIGF0dHIub25JbnB1dCA9IChldikgPT4ge1xuICAgICAgICBldi5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKVxuICAgICAgICBldi5zdG9wUHJvcGFnYXRpb24oKVxuICAgICAgICBjb25zdCB2YWx1ZSA9IGV2LmN1cnJlbnRUYXJnZXQudmFsdWVcbiAgICAgICAgY2xlYXJUaW1lb3V0KGlkKVxuICAgICAgICBpZCA9IHNldFRpbWVvdXQoKCkgPT4gc2VhcmNoKHZhbHVlKSwgMTAwMClcbiAgICAgIH1cbiAgICB9KVxuICB9KVxufSlcblxuY29uc3QgUGFnaW5nID0gY29tcG9uZW50KCgpID0+IHtcbiAgY29uc3QgeyBwYWdlIH0gPSBCb29ydVxuXG4gIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICBhdHRyLmNsYXNzID0gXCJuYXYtcGFnaW5nXCJcbiAgICBhZGRFbGVtZW50KFwiYnV0dG9uXCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJwcmV2aW91c1wiXG4gICAgICBhdHRyLnRleHRDb250ZW50ID0gKCkgPT4gU3RyaW5nKHBhZ2UoKSAtIDEpXG4gICAgICBhdHRyLmRpc2FibGVkID0gKCkgPT4gcGFnZSgpIDw9IDFcbiAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHBhZ2UocGFnZSgpIC0gMSlcbiAgICB9KVxuICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIuY2xhc3MgPSBcImN1cnJlbnRcIlxuICAgICAgYXR0ci5kaXNhYmxlZCA9IHRydWVcbiAgICAgIGF0dHIudGV4dENvbnRlbnQgPSAoKSA9PiBTdHJpbmcocGFnZSgpKVxuICAgIH0pXG4gICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwibmV4dFwiXG4gICAgICBhdHRyLnRleHRDb250ZW50ID0gKCkgPT4gU3RyaW5nKHBhZ2UoKSArIDEpXG4gICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiBwYWdlKHBhZ2UoKSArIDEpXG4gICAgfSlcbiAgfSlcbn0pXG5cbmNvbnN0IEFkZFNvdXJjZSA9IGNvbXBvbmVudCgoKSA9PiB7XG4gIGNvbnN0IG5hbWUgPSBzaWduYWwoXCJcIilcbiAgY29uc3QgdXJsID0gc2lnbmFsKFwiXCIpXG5cbiAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgIGF0dHIuY2xhc3MgPSBcImZsZXggcGFkZGluZy0xMFwiXG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGFsaWduLWl0ZW1zLWJhc2VsaW5lXCJcbiAgICAgIGFkZEVsZW1lbnQoXCJsYWJlbFwiLCAoYXR0cikgPT4gYXR0ci50ZXh0Q29udGVudCA9IFwibmFtZTpcIilcbiAgICAgIGFkZEVsZW1lbnQoXCJpbnB1dFwiLCAoYXR0cikgPT4ge1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJmbGV4LTFcIlxuICAgICAgICBhdHRyLm5hbWUgPSBcIm5hbWVcIlxuICAgICAgICBhdHRyLnZhbHVlID0gbmFtZVxuICAgICAgICBhdHRyLm9uSW5wdXQgPSAoZXYpID0+IG5hbWUoZXYuY3VycmVudFRhcmdldC52YWx1ZSlcbiAgICAgICAgYXR0ci5wbGFjZWhvbGRlciA9IFwiKkJvb3J1XCJcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIuY2xhc3MgPSBcImZsZXggYWxpZ24taXRlbXMtYmFzZWxpbmVcIlxuICAgICAgYWRkRWxlbWVudChcImxhYmVsXCIsIChhdHRyKSA9PiBhdHRyLnRleHRDb250ZW50ID0gXCJ1cmw6XCIpXG4gICAgICBhZGRFbGVtZW50KFwiaW5wdXRcIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci5jbGFzcyA9IFwiZmxleC0xXCJcbiAgICAgICAgYXR0ci5uYW1lID0gXCJ1cmxcIlxuICAgICAgICBhdHRyLnZhbHVlID0gdXJsXG4gICAgICAgIGF0dHIub25JbnB1dCA9IChldikgPT4gdXJsKGV2LmN1cnJlbnRUYXJnZXQudmFsdWUpXG4gICAgICAgIGF0dHIucGxhY2Vob2xkZXIgPSBcImh0dHBzOi8vLi4uXCJcbiAgICAgIH0pXG4gICAgfSlcblxuICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gcGx1c1wiXG4gICAgICBhdHRyLnRpdGxlID0gXCJhZGQgc291cmNlXCJcbiAgICAgIGF0dHIuZGlzYWJsZWQgPSAoKSA9PiAhbmFtZSgpIHx8ICF1cmwoKVxuICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4ge1xuICAgICAgICBpZiAoIW5hbWUoKSB8fCAhdXJsKCkpIHJldHVyblxuICAgICAgICBsb2NhbFNvdXJjZXMoXG4gICAgICAgICAgbG9jYWxTb3VyY2VzKCkuY29uY2F0KHtcbiAgICAgICAgICAgIG5hbWU6IG5hbWUoKSxcbiAgICAgICAgICAgIHVybDogdXJsKCksXG4gICAgICAgICAgfSksXG4gICAgICAgIClcbiAgICAgICAgdXJsKFwiXCIpXG4gICAgICAgIG5hbWUoXCJcIilcbiAgICAgIH1cbiAgICB9KVxuXG4gICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwiaWNvbiBpbXBvcnRcIlxuICAgICAgYXR0ci50aXRsZSA9IFwiaW1wb3J0IHNvdXJjZVwiXG4gICAgICBhdHRyLm9uQ2xpY2sgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgIGNvbnN0IGRhdGEgPSBhd2FpdCB1cGxvYWRGaWxlKFwiLmpzb25cIiwgXCJyZWFkQXNUZXh0XCIpXG4gICAgICAgIGNvbnN0IGpzb24gPSBKU09OLnBhcnNlKGRhdGEpXG4gICAgICAgIGNvbnN0IGltcG9ydGVkU291cmNlczogU291cmNlW10gPSBbXVxuICAgICAgICBpZiAoQXJyYXkuaXNBcnJheShqc29uKSkge1xuICAgICAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIGpzb24pIHtcbiAgICAgICAgICAgIGlmIChzb3VyY2UubmFtZSAmJiBzb3VyY2UudXJsKSB7XG4gICAgICAgICAgICAgIGltcG9ydGVkU291cmNlcy5wdXNoKHNvdXJjZSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgbG9jYWxTb3VyY2VzKGxvY2FsU291cmNlcygpLmNvbmNhdChpbXBvcnRlZFNvdXJjZXMpKVxuICAgICAgfVxuICAgIH0pXG4gIH0pXG59KVxuXG5jb25zdCBTb3VyY2VFZGl0ID0gY29tcG9uZW50KChzb3VyY2U6IFNvdXJjZSkgPT4ge1xuICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgYXR0ci5jbGFzcyA9IFwiZmxleCBqdXN0aWZ5LWNvbnRlbnQtY2VudGVyIHBhZGRpbmctMTBcIlxuXG4gICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwiZmxleCBhbGlnbi1pdGVtcy1iYXNlbGluZVwiXG4gICAgICBhZGRFbGVtZW50KFwibGFiZWxcIiwgKGF0dHIpID0+IGF0dHIudGV4dENvbnRlbnQgPSBcIm5hbWU6XCIpXG4gICAgICBhZGRFbGVtZW50KFwiaW5wdXRcIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci5jbGFzcyA9IFwiZmxleC0xXCJcbiAgICAgICAgYXR0ci5uYW1lID0gXCJuYW1lXCJcbiAgICAgICAgYXR0ci52YWx1ZSA9IHNvdXJjZS5uYW1lXG4gICAgICAgIGF0dHIucGxhY2Vob2xkZXIgPSBcIipCb29ydVwiXG4gICAgICAgIGF0dHIub25JbnB1dCA9IChldikgPT4gc291cmNlLm5hbWUgPSBldi5jdXJyZW50VGFyZ2V0LnZhbHVlXG4gICAgICB9KVxuICAgIH0pXG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGFsaWduLWl0ZW1zLWJhc2VsaW5lXCJcbiAgICAgIGFkZEVsZW1lbnQoXCJsYWJlbFwiLCAoYXR0cikgPT4gYXR0ci50ZXh0Q29udGVudCA9IFwidXJsOlwiKVxuICAgICAgYWRkRWxlbWVudChcImlucHV0XCIsIChhdHRyKSA9PiB7XG4gICAgICAgIGF0dHIuY2xhc3MgPSBcImZsZXgtMVwiXG4gICAgICAgIGF0dHIudmFsdWUgPSBzb3VyY2UudXJsXG4gICAgICAgIGF0dHIucGxhY2Vob2xkZXIgPSBcImh0dHBzOi8vLi4uXCJcbiAgICAgICAgYXR0ci5vbklucHV0ID0gKGV2KSA9PiBzb3VyY2UudXJsID0gZXYuY3VycmVudFRhcmdldC52YWx1ZVxuICAgICAgfSlcbiAgICB9KVxuXG4gICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwiaWNvbiBjaGVja1wiXG4gICAgICBhdHRyLnRpdGxlID0gXCJzYXZlIHNvdXJjZVwiXG4gICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiB7XG4gICAgICAgIGNvbnN0IG5ld1NvdXJjZSA9IHsgdXJsOiBzb3VyY2UudXJsLCBuYW1lOiBzb3VyY2UubmFtZSB9XG4gICAgICAgIGxvY2FsU291cmNlcyhcbiAgICAgICAgICBsb2NhbFNvdXJjZXMoKVxuICAgICAgICAgICAgLmZpbHRlcigoJCkgPT4gJCAhPT0gc291cmNlKVxuICAgICAgICAgICAgLmNvbmNhdChuZXdTb3VyY2UpLFxuICAgICAgICApXG4gICAgICB9XG4gICAgfSlcblxuICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gZGVsZXRlXCJcbiAgICAgIGF0dHIudGl0bGUgPSBcImRlbGV0ZSBzb3VyY2VcIlxuICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4ge1xuICAgICAgICBsb2NhbFNvdXJjZXMobG9jYWxTb3VyY2VzKCkuZmlsdGVyKCgkKSA9PiAkICE9PSBzb3VyY2UpKVxuICAgICAgfVxuICAgIH0pXG4gIH0pXG59KVxuIiwiaW1wb3J0IHtcbiAgYWRkRWxlbWVudCxcbiAgY29tcG9uZW50LFxuICBlZmZlY3QsXG4gIG9uQ2xlYW51cCxcbiAgc2lnbmFsLFxuICB2aWV3LFxufSBmcm9tIFwiLi4vZGVwcy50c1wiXG5pbXBvcnQgQm9vcnUgZnJvbSBcIi4uL2NvbnRleHQudHNcIlxuXG5jb25zdCBQcmV2aWV3VG9wQmFyID0gY29tcG9uZW50KCgpID0+IHtcbiAgY29uc3QgeyBzZWxlY3QgfSA9IEJvb3J1XG5cbiAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgIGF0dHIuY2xhc3MgPSBcInRvcCB6LWluZGV4LTFcIlxuICAgIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIuY2xhc3MgPSBcInRpdGxlXCJcbiAgICAgIGF0dHIudGV4dENvbnRlbnQgPSAoKSA9PiBTdHJpbmcoc2VsZWN0KCk/LmZpbGVVcmwpXG4gICAgfSlcblxuICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIudHlwZSA9IFwiYnV0dG9uXCJcbiAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gY2xvc2VcIlxuICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4gc2VsZWN0KHVuZGVmaW5lZClcbiAgICB9KVxuICB9KVxufSlcblxuY29uc3QgVGFncyA9IGNvbXBvbmVudCgoKSA9PiB7XG4gIGNvbnN0IHsgc2VsZWN0LCBoYXNUYWcsIGFkZFRhZyB9ID0gQm9vcnVcblxuICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgYXR0ci5jbGFzcyA9IFwicHJldmlldy10YWdzXCJcbiAgICB2aWV3KCgpID0+IHtcbiAgICAgIGNvbnN0IHBvc3QgPSBzZWxlY3QoKVxuICAgICAgaWYgKHBvc3QgPT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgICAgIGZvciAoY29uc3QgdGFnIG9mIHBvc3QudGFncykge1xuICAgICAgICBhZGRFbGVtZW50KFwic3BhblwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIuY2xhc3MgPSBcInRhZ1wiXG4gICAgICAgICAgYXR0ci50ZXh0Q29udGVudCA9IHRhZ1xuICAgICAgICAgIGF0dHIuc3RhdGUgPSAoKSA9PiBoYXNUYWcodGFnKSA/IFwiYWN0aXZlXCIgOiBcIlwiXG4gICAgICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4gYWRkVGFnKHRhZylcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICB9KVxuICB9KVxufSlcblxuZXhwb3J0IGNvbnN0IFByZXZpZXcgPSBjb21wb25lbnQoKCkgPT4ge1xuICBjb25zdCB7IHNlbGVjdCwgc2l6ZSwgbG9hZGVkIH0gPSBCb29ydVxuICBjb25zdCBzb3VyY2UgPSBzaWduYWw8c3RyaW5nPihcIlwiKVxuICBjb25zdCByZWFkeSA9IHNpZ25hbChmYWxzZSlcblxuICBlZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGl0ZW0gPSBzZWxlY3QoKVxuICAgIHNvdXJjZShpdGVtPy5maWxlVXJsKVxuICAgIG9uQ2xlYW51cCgoKSA9PiByZWFkeShmYWxzZSkpXG4gIH0pXG5cbiAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgIGF0dHIuY2xhc3MgPSBcImxvYWRpbmdcIlxuICAgIGF0dHIucmVhZHkgPSAoKSA9PiBzaXplKCkgPD0gbG9hZGVkKClcbiAgICBhdHRyLnRleHRDb250ZW50ID0gKCkgPT4ge1xuICAgICAgY29uc3QgdmFsdWUgPSBTdHJpbmcoTWF0aC5mbG9vcigobG9hZGVkKCkgLyBzaXplKCkpICogMTAwKSlcbiAgICAgIGlmICh2YWx1ZSA9PT0gXCJOYU5cIikgcmV0dXJuIFwiTG9hZGluZy4uLiAwJVwiXG4gICAgICByZXR1cm4gXCJMb2FkaW5nLi4uIFwiICsgdmFsdWUgKyBcIiVcIlxuICAgIH1cbiAgfSlcblxuICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgYXR0ci5jbGFzcyA9IFwicHJldmlld1wiXG4gICAgYXR0ci5hY3RpdmUgPSAoKSA9PiByZWFkeSgpICYmIHNlbGVjdCgpICE9PSB1bmRlZmluZWRcbiAgICBQcmV2aWV3VG9wQmFyKClcblxuICAgIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIuY2xhc3MgPSBcInByZXZpZXctY29udGVudFwiXG5cbiAgICAgIHZpZXcoKCkgPT4ge1xuICAgICAgICBpZiAoc291cmNlKCkgPT09IHVuZGVmaW5lZCkgcmV0dXJuXG4gICAgICAgIGlmIChzZWxlY3QoKSA9PT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgICAgICAgYWRkRWxlbWVudChcImltZ1wiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIuc3JjID0gc291cmNlKClcbiAgICAgICAgICBhdHRyLmFsdCA9IHNlbGVjdCgpIS5maWxlVXJsXG4gICAgICAgICAgYXR0ci5vbkxvYWQgPSAoKSA9PiByZWFkeSh0cnVlKVxuICAgICAgICAgIGF0dHIub25FcnJvciA9ICgpID0+IHNvdXJjZShzZWxlY3QoKSEucHJldmlld1VybClcbiAgICAgICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiBvcGVuKHNlbGVjdCgpIS5maWxlVXJsLCBcIl9ibGFua1wiKVxuICAgICAgICB9KVxuICAgICAgfSlcblxuICAgICAgVGFncygpXG4gICAgfSlcbiAgfSlcbn0pXG5cbmV4cG9ydCBkZWZhdWx0IFByZXZpZXdcbiIsImltcG9ydCB7IGFkZEVsZW1lbnQsIGNvbXBvbmVudCwgZWxlbWVudFJlZiwgb25Nb3VudCwgdmlldyB9IGZyb20gXCIuLi9kZXBzLnRzXCJcbmltcG9ydCBCb29ydSBmcm9tIFwiLi4vY29udGV4dC50c1wiXG5cbmV4cG9ydCBjb25zdCBQb3N0cyA9IGNvbXBvbmVudCgoKSA9PiB7XG4gIGNvbnN0IHsgcG9zdHMsIGhpZ2hsaWdodGVkLCBzZWxlY3QsIGxvYWRlZCwgc2l6ZSB9ID0gQm9vcnVcblxuICBhZGRFbGVtZW50KFwibWFpblwiLCAoYXR0cikgPT4ge1xuICAgIGNvbnN0IHJlZiA9IGVsZW1lbnRSZWYoKSFcbiAgICBhdHRyLnJlYWR5ID0gKCkgPT4gc2l6ZSgpIDw9IGxvYWRlZCgpXG4gICAgdmlldygoKSA9PiB7XG4gICAgICBvbk1vdW50KCgpID0+IHJlZi5zY3JvbGxUbyh7IHRvcDogMCwgYmVoYXZpb3I6IFwic21vb3RoXCIgfSkpXG4gICAgICBmb3IgKGNvbnN0IHBvc3Qgb2YgcG9zdHMoKSkge1xuICAgICAgICBhZGRFbGVtZW50KFwiYXJ0aWNsZVwiLCAoKSA9PiB7XG4gICAgICAgICAgYWRkRWxlbWVudChcImltZ1wiLCAoYXR0cikgPT4ge1xuICAgICAgICAgICAgYXR0ci5zcmMgPSBwb3N0LnByZXZpZXdVcmxcbiAgICAgICAgICAgIGF0dHIuYWx0ID0gYXR0ci5zcmNcbiAgICAgICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHNlbGVjdChwb3N0KVxuICAgICAgICAgICAgYXR0ci5vbkxvYWQgPSAoKSA9PiBsb2FkZWQobG9hZGVkKCkgKyAxKVxuICAgICAgICAgICAgYXR0ci5vbkVycm9yID0gYXR0ci5vbkxvYWRcbiAgICAgICAgICAgIGF0dHIub25Nb3VzZU92ZXIgPSAoKSA9PiBoaWdobGlnaHRlZChwb3N0LnRhZ3MpXG4gICAgICAgICAgICBhdHRyLm9uTW91c2VPdXQgPSAoKSA9PiBoaWdobGlnaHRlZChbXSlcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuICAgICAgfVxuICAgIH0pXG4gIH0pXG59KVxuXG5leHBvcnQgZGVmYXVsdCBQb3N0c1xuIiwiaW1wb3J0IHsgY29tcG9uZW50LCByZW5kZXIgfSBmcm9tIFwiLi9kZXBzLnRzXCJcbmltcG9ydCBOYXZpZ2F0aW9uIGZyb20gXCIuL2NvbXBvbmVudHMvbmF2aWdhdGlvbi50c1wiXG5pbXBvcnQgUHJldmlldyBmcm9tIFwiLi9jb21wb25lbnRzL3ByZXZpZXcudHNcIlxuaW1wb3J0IFBvc3RzIGZyb20gXCIuL2NvbXBvbmVudHMvcG9zdHMudHNcIlxuXG5jb25zdCBBcHAgPSBjb21wb25lbnQoKCkgPT4ge1xuICBOYXZpZ2F0aW9uKClcbiAgUG9zdHMoKVxuICBQcmV2aWV3KClcbn0pXG5cbmNvbnN0IF9jbGVhbnVwID0gcmVuZGVyKGRvY3VtZW50LmJvZHksICgpID0+IHtcbiAgQXBwKClcbn0pXG4iXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBOEJBLE1BQU0sUUFBUTtBQUNkLE1BQU0sUUFBUSxJQUFJO0FBQ2xCLElBQUk7QUFDSixJQUFJO0FBRUcsU0FBUyxPQUFnQixRQUFpQyxFQUFZO0lBQzNFLE1BQU0sT0FBTztJQUNiLGFBQWE7SUFDYixJQUFJO1FBQ0YsT0FBTyxNQUFNLElBQU07WUFDakIsSUFBSSxXQUFvQztZQUN4QyxJQUFJLFNBQVMsTUFBTSxFQUFFO2dCQUNuQixXQUFXLFVBQVUsSUFBSSxDQUFDLFdBQVcsTUFBTSxJQUFJO1lBQ2pELENBQUM7WUFDRCxPQUFPLFNBQVM7UUFDbEI7SUFDRixFQUFFLE9BQU8sT0FBTztRQUNkLFlBQVk7SUFDZCxTQUFVO1FBQ1IsYUFBYSxLQUFLLFVBQVU7SUFDOUI7QUFDRjtBQVlBLFNBQVMsV0FDUCxZQUFrQixFQUNsQixRQUE0QyxFQUNyQjtJQUN2QixNQUFNLE9BQWE7UUFDakIsT0FB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
