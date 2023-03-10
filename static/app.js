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
        params.set("page", page().toString());
        params.set("limit", limit().toString());
        params.set("url", url());
        if (search().length) params.set("search", search());
        else params.delete("search");
        if (tags().length) params.set("tags", tags().join(","));
        else params.delete("tags");
        removeEventListener("popstate", onPopState);
        location.hash = params.toString();
        addEventListener("popstate", onPopState);
        return params;
    }, new URLSearchParams(getHash()));
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
function Window(props) {
    const show = signal(false);
    const fullscreen = signal(false);
    effect(()=>show(props.show()));
    effect(()=>{
        if (show()) props.onOpen?.();
        else props.onClose?.();
    });
    addElement("div", (attr)=>{
        attr.show = show;
        attr.class = "window";
        attr.fullscreen = fullscreen;
        attr.style = {
            width: props.width,
            height: props.height
        };
        addElement("div", (attr)=>{
            attr.class = "window-title";
            addElement("h3", (attr)=>{
                attr.textContent = props.title;
                attr.title = props.title;
            });
            addElement("div", (attr)=>{
                attr.class = "window-title-children";
                if (props.titleChildren) {
                    view(props.titleChildren);
                }
                addElement("button", (attr)=>{
                    attr.class = ()=>`icon ${fullscreen() ? "compress" : "enlarge"}`;
                    attr.title = ()=>`${fullscreen() ? "compress" : "enlarge"} window`;
                    attr.onClick = ()=>fullscreen(!fullscreen());
                });
                addElement("button", (attr)=>{
                    attr.class = "icon close";
                    attr.title = "close window";
                    attr.onClick = ()=>show(false);
                });
            });
        });
        addElement("div", (attr)=>{
            attr.class = "window-content";
            addElement("div", (attr)=>{
                attr.class = "window-content-wrapper";
                view(props.children);
            });
        });
    });
    return props;
}
const __default1 = component(Window);
const SourceEditor = component((sourceEdit)=>{
    __default1({
        title: ()=>"source editor",
        show: sourceEdit,
        titleChildren () {
            addElement("button", (attr)=>{
                attr.class = "icon download-json";
                attr.title = "download sources";
                attr.onClick = ()=>{
                    download(`sources-${Date.now()}.json`, "application/json", JSON.stringify(localSources(), null, 2));
                };
            });
        },
        children () {
            for (const source of localSources()){
                SourceEdit(source);
            }
            AddSource();
        }
    });
});
const AddSource = component(()=>{
    const name = signal("");
    const url = signal("");
    addElement("div", (attr)=>{
        attr.class = "flex justify-content-space-betwee flex-gap-10";
        addElement("div", (attr)=>{
            attr.class = "flex align-items-baseline width-100";
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
            attr.class = "flex align-items-baseline width-100";
            addElement("label", (attr)=>attr.textContent = "url:");
            addElement("input", (attr)=>{
                attr.class = "flex-1";
                attr.name = "url";
                attr.value = url;
                attr.onInput = (ev)=>url(ev.currentTarget.value);
                attr.placeholder = "https://...";
            });
        });
        addElement("div", (attr)=>{
            attr.class = "flex";
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
});
const SourceEdit = component((source)=>{
    addElement("div", (attr)=>{
        attr.class = "flex justify-content-space-between flex-gap-10";
        addElement("div", (attr)=>{
            attr.class = "flex align-items-baseline width-100";
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
            attr.class = "flex align-items-baseline width-100";
            addElement("label", (attr)=>attr.textContent = "url:");
            addElement("input", (attr)=>{
                attr.class = "flex-1";
                attr.value = source.url;
                attr.placeholder = "https://...";
                attr.onInput = (ev)=>source.url = ev.currentTarget.value;
            });
        });
        addElement("div", (attr)=>{
            attr.class = "flex";
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
});
const cache = new Map();
function useWiki(id, trigger) {
    const wiki = signal(id);
    effect(on(trigger, ()=>{
        if (trigger() === false) return wiki(id);
        if (cache.has(id)) return wiki(cache.get(id));
        fetch(`https://danbooru.donmai.us/wiki_pages/${id}.json`).then(async (res)=>{
            cache.set(id, res.ok ? (await res.json()).body : id);
        });
    }));
    return wiki;
}
const Tag = component((name)=>{
    const { toggleTag , tags , highlighted  } = __default;
    const trigger = signal(false);
    const wiki = useWiki(name, trigger);
    addElement("div", (attr)=>{
        attr.textContent = name;
        attr.class = "tag";
        attr.title = wiki;
        attr.onClick = ()=>toggleTag(name);
        attr.onMouseOver = ()=>trigger(true);
        attr.onMouseOut = ()=>trigger(false);
        attr.state = ()=>{
            if (tags().includes(name)) return "active";
            else if (highlighted().includes(name)) return "highlight";
        };
    });
});
const Navigation = component(()=>{
    const { postTags , tags , page  } = __default;
    const sourceEdit = signal(false);
    addElement("nav", ()=>{
        const ref = elementRef();
        SourceEditor(sourceEdit);
        addElement("div", (attr)=>{
            attr.class = "nav-top";
            Inputs(sourceEdit);
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
        addElement("div", (attr)=>{
            attr.class = "overflow-auto flex-1";
            view(()=>{
                const selTags = tags();
                onMount(()=>ref.scrollTo({
                        top: 0,
                        behavior: "smooth"
                    }));
                for (const tag of tags())Tag(tag);
                for (const tag of postTags().filter((tag)=>!selTags.includes(tag))){
                    Tag(tag);
                }
            });
        });
    });
});
const Inputs = component((sourceEdit)=>{
    const { search , url  } = __default;
    const pervert = usePervert();
    addElement("div", (attr)=>{
        attr.class = "flex align-items-center";
        view(()=>{
            if (pervert() === false) return;
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
            attr.onKeyUp = (ev)=>{
                const value = ev.currentTarget.value;
                clearTimeout(id);
                id = setTimeout(()=>search(value), 1000);
            };
        });
    });
});
const loads = signal(new Set());
function useLoading() {
    let timeoutId;
    render(document.body, ()=>{
        addElement("div", (attr)=>{
            attr.style = {
                position: "fixed",
                bottom: "10px",
                right: "10px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                zIndex: "9999",
                pointerEvents: "none"
            };
            view(()=>{
                for (const props of loads()){
                    addElement("div", (attr)=>{
                        attr.class = "loading";
                        attr.textContent = props.text;
                        attr.loading = ()=>{
                            const result = props.on();
                            clearTimeout(timeoutId);
                            if (props.on()) {
                                loads().delete(props);
                                timeoutId = setTimeout(()=>loads(($)=>$), 2000);
                            }
                            return result;
                        };
                    });
                }
            });
        });
    });
}
function load(props) {
    queueMicrotask(()=>{
        loads(loads().add(props));
    });
}
const Preview = component(()=>{
    const { select , posts  } = __default;
    const source = signal("");
    const show = signal(false);
    effect(()=>{
        const item = select();
        source(item?.fileUrl);
        onCleanup(()=>show(false));
    });
    const onKeyUp = (ev)=>{
        if (ev.key === "ArrowRight") showNext();
        else if (ev.key === "ArrowLeft") showPrevious();
    };
    const showPrevious = ()=>{
        const index = posts().indexOf(select());
        const prev = index - 1 === -1 ? posts().length - 1 : index - 1;
        select(posts()[prev]);
    };
    const showNext = ()=>{
        const index = posts().indexOf(select());
        const next = index + 1 === posts().length ? 0 : index + 1;
        select(posts()[next]);
    };
    __default1({
        title: ()=>String(select()?.fileUrl),
        show: show,
        width: "100vw",
        onOpen: ()=>addEventListener("keyup", onKeyUp),
        onClose: ()=>removeEventListener("keyup", onKeyUp),
        titleChildren () {
            addElement("button", (attr)=>{
                attr.class = "icon left";
                attr.onClick = showPrevious;
            });
            addElement("button", (attr)=>{
                attr.class = "icon right";
                attr.onClick = showNext;
            });
            addElement("button", (attr)=>{
                attr.class = "icon curly-arrow";
                attr.title = "open file in new tab";
                attr.onClick = ()=>open(select().fileUrl, "_blank");
            });
        },
        children () {
            addElement("div", (attr)=>{
                attr.style = `
          display: flex;
          gap: 10px;
          align-items: flex-start;
        `;
                view(()=>{
                    const post = select();
                    if (post === undefined) return;
                    if (source() === undefined) return;
                    load({
                        on: show,
                        text: ()=>`loading ${post.id}`
                    });
                    addElement("img", (attr)=>{
                        attr.style = `
              object-fit: contain;
              flex: 1;
              width: 500px;
              min-width: 500px;
            `;
                        attr.src = source();
                        attr.alt = post.fileUrl || "";
                        attr.onLoad = ()=>show(true);
                        attr.onError = ()=>source(post.previewUrl);
                    });
                    addElement("div", (attr)=>{
                        attr.style = `
              display: flex;
              gap: 5px;
              flex-wrap: wrap;
            }`;
                        for (const tag of post.tags)Tag(tag);
                    });
                });
            });
        }
    });
});
const Posts = component(()=>{
    const { posts , highlighted , select , loaded , size  } = __default;
    addElement("main", (attr)=>{
        const ref = elementRef();
        attr.ready = ()=>size() <= loaded();
        view(()=>{
            load({
                on: ()=>size() <= loaded(),
                text: ()=>`loading posts ${loaded()}/${size()}`
            });
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
    useLoading();
    App();
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImh0dHBzOi8vcmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbS9taW5pLWphaWwvc2lnbmFsL21haW4vbW9kLnRzIiwiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL21pbmktamFpbC9kb20vbWFpbi9tb2QudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9jb21wb25lbnRzL3VzZS1ib29ydS50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvdXNlLXRpdGxlLnRzIiwiZmlsZTovLy9tbnQvMEE1NTRDNkUzQzY4RTY2QS9Qcm9qZWt0ZS9naXRodWIvYnVyYXV6YS9zcmMvY29udGV4dC50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvdXNlLXBlcnZlcnQudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9jb21wb25lbnRzL3VwbG9hZC50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvZG93bmxvYWQudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9jb21wb25lbnRzL3dpbmRvdy50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvc291cmNlLWVkaXRvci50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvdXNlLXdpa2kudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9jb21wb25lbnRzL3RhZy50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvbmF2aWdhdGlvbi50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvbG9hZGluZy50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvcHJldmlldy50cyIsImZpbGU6Ly8vbW50LzBBNTU0QzZFM0M2OEU2NkEvUHJvamVrdGUvZ2l0aHViL2J1cmF1emEvc3JjL2NvbXBvbmVudHMvcG9zdHMudHMiLCJmaWxlOi8vL21udC8wQTU1NEM2RTNDNjhFNjZBL1Byb2pla3RlL2dpdGh1Yi9idXJhdXphL3NyYy9hcHAudHMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IHR5cGUgQ2xlYW51cCA9ICgpID0+IHZvaWRcbmV4cG9ydCB0eXBlIFNpZ25hbDxUID0gYW55PiA9IHtcbiAgKCk6IFRcbiAgKHZhbHVlOiBUIHwgdW5kZWZpbmVkKTogdm9pZFxuICAoY2FsbGJhY2s6IChjdXJyZW50OiBUIHwgdW5kZWZpbmVkKSA9PiBUKTogdm9pZFxufVxuZXhwb3J0IHR5cGUgU291cmNlPFQgPSBhbnk+ID0ge1xuICB2YWx1ZTogVCB8IHVuZGVmaW5lZCB8IG51bGxcbiAgbm9kZXM6IE5vZGVbXSB8IHVuZGVmaW5lZFxuICBub2RlU2xvdHM6IG51bWJlcltdIHwgdW5kZWZpbmVkXG59XG5leHBvcnQgdHlwZSBOb2RlPFQgPSBhbnk+ID0ge1xuICB2YWx1ZTogVCB8IHVuZGVmaW5lZCB8IG51bGxcbiAgcGFyZW50Tm9kZTogTm9kZSB8IHVuZGVmaW5lZFxuICBjaGlsZHJlbjogTm9kZVtdIHwgdW5kZWZpbmVkXG4gIGluamVjdGlvbnM6IHsgW2lkOiBzeW1ib2xdOiBhbnkgfSB8IHVuZGVmaW5lZFxuICBjbGVhbnVwczogQ2xlYW51cFtdIHwgdW5kZWZpbmVkXG4gIGNhbGxiYWNrOiAoKGN1cnJlbnQ6IFQpID0+IFQpIHwgdW5kZWZpbmVkXG4gIHNvdXJjZXM6IFNvdXJjZVtdIHwgdW5kZWZpbmVkXG4gIHNvdXJjZVNsb3RzOiBudW1iZXJbXSB8IHVuZGVmaW5lZFxufVxuZXhwb3J0IHR5cGUgUmVmPFQgPSBhbnk+ID0ge1xuICB2YWx1ZTogVFxufVxuZXhwb3J0IHR5cGUgUHJvdmlkZXI8VD4gPSA8Uj4odmFsdWU6IFQsIGNhbGxiYWNrOiAoKSA9PiBSKSA9PiBSXG5leHBvcnQgdHlwZSBJbmplY3Rpb248VD4gPSB7XG4gIHJlYWRvbmx5IGlkOiBzeW1ib2xcbiAgcmVhZG9ubHkgZGVmYXVsdFZhbHVlOiBUIHwgdW5kZWZpbmVkXG59XG5cbmNvbnN0IEVycm9yID0gU3ltYm9sKClcbmNvbnN0IFF1ZXVlID0gbmV3IFNldDxOb2RlPigpXG5sZXQgbm9kZVF1ZXVlOiBTZXQ8Tm9kZT4gfCB1bmRlZmluZWRcbmxldCBwYXJlbnROb2RlOiBOb2RlIHwgdW5kZWZpbmVkXG5cbmV4cG9ydCBmdW5jdGlvbiBzY29wZWQ8VCA9IGFueT4oY2FsbGJhY2s6IChjbGVhbnVwOiBDbGVhbnVwKSA9PiBUKTogVCB8IHZvaWQge1xuICBjb25zdCBub2RlID0gY3JlYXRlTm9kZTxUPigpXG4gIHBhcmVudE5vZGUgPSBub2RlXG4gIHRyeSB7XG4gICAgcmV0dXJuIGJhdGNoKCgpID0+IHtcbiAgICAgIGxldCBfY2xlYW51cDogQ2xlYW51cCB8IG5ldmVyID0gPG5ldmVyPiB1bmRlZmluZWRcbiAgICAgIGlmIChjYWxsYmFjay5sZW5ndGgpIHtcbiAgICAgICAgX2NsZWFudXAgPSBjbGVhbk5vZGUuYmluZCh1bmRlZmluZWQsIG5vZGUsIHRydWUpXG4gICAgICB9XG4gICAgICByZXR1cm4gY2FsbGJhY2soX2NsZWFudXApXG4gICAgfSkhXG4gIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgaGFuZGxlRXJyb3IoZXJyb3IpXG4gIH0gZmluYWxseSB7XG4gICAgcGFyZW50Tm9kZSA9IG5vZGUucGFyZW50Tm9kZVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub2RlUmVmKCk6IE5vZGUgfCB1bmRlZmluZWQge1xuICByZXR1cm4gcGFyZW50Tm9kZVxufVxuXG5mdW5jdGlvbiBjcmVhdGVOb2RlPFQgPSBhbnk+KCk6IE5vZGU8VCB8IHVuZGVmaW5lZD5cbmZ1bmN0aW9uIGNyZWF0ZU5vZGU8VCA9IGFueT4oaW5pdGlhbFZhbHVlOiBUKTogTm9kZTxUPlxuZnVuY3Rpb24gY3JlYXRlTm9kZTxUID0gYW55PihcbiAgaW5pdGlhbFZhbHVlOiBULFxuICBjYWxsYmFjazogKGN1cnJlbnQ6IFQgfCB1bmRlZmluZWQpID0+IFQsXG4pOiBOb2RlPFQ+XG5mdW5jdGlvbiBjcmVhdGVOb2RlKFxuICBpbml0aWFsVmFsdWU/OiBhbnksXG4gIGNhbGxiYWNrPzogKGN1cnJlbnQ6IGFueSB8IHVuZGVmaW5lZCkgPT4gYW55LFxuKTogTm9kZTxhbnkgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3Qgbm9kZTogTm9kZSA9IHtcbiAgICB2YWx1ZTogaW5pdGlhbFZhbHVlLFxuICAgIHBhcmVudE5vZGUsXG4gICAgY2hpbGRyZW46IHVuZGVmaW5lZCxcbiAgICBpbmplY3Rpb25zOiB1bmRlZmluZWQsXG4gICAgY2xlYW51cHM6IHVuZGVmaW5lZCxcbiAgICBjYWxsYmFjayxcbiAgICBzb3VyY2VzOiB1bmRlZmluZWQsXG4gICAgc291cmNlU2xvdHM6IHVuZGVmaW5lZCxcbiAgfVxuICBpZiAocGFyZW50Tm9kZSkge1xuICAgIGlmIChwYXJlbnROb2RlLmNoaWxkcmVuID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmVudE5vZGUuY2hpbGRyZW4gPSBbbm9kZV1cbiAgICB9IGVsc2Uge1xuICAgICAgcGFyZW50Tm9kZS5jaGlsZHJlbi5wdXNoKG5vZGUpXG4gICAgfVxuICB9XG4gIHJldHVybiBub2RlXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvbk1vdW50KGNhbGxiYWNrOiAoKSA9PiB2b2lkKTogdm9pZCB7XG4gIGVmZmVjdCgoKSA9PiB1bnRyYWNrKGNhbGxiYWNrKSlcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG9uRGVzdHJveShjYWxsYmFjazogKCkgPT4gdm9pZCk6IHZvaWQge1xuICBvbkNsZWFudXAoKCkgPT4gdW50cmFjayhjYWxsYmFjaykpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvbjxUPihcbiAgZGVwZW5kZW5jeTogKCkgPT4gdW5rbm93bixcbiAgY2FsbGJhY2s6IChjdXJyZW50OiBUIHwgdW5kZWZpbmVkKSA9PiBULFxuKTogKGN1cnJlbnQ6IFQgfCB1bmRlZmluZWQpID0+IFQge1xuICByZXR1cm4gKChjdXJyZW50KSA9PiB7XG4gICAgZGVwZW5kZW5jeSgpXG4gICAgcmV0dXJuIHVudHJhY2soKCkgPT4gY2FsbGJhY2soY3VycmVudCkpXG4gIH0pXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlZmZlY3Q8VD4oY2FsbGJhY2s6IChjdXJyZW50OiBUIHwgdW5kZWZpbmVkKSA9PiBUKTogdm9pZFxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdDxULCBJPihcbiAgY2FsbGJhY2s6IChjdXJyZW50OiBJIHwgVCkgPT4gVCxcbiAgaW5pdGlhbFZhbHVlOiBJLFxuKTogdm9pZFxuZXhwb3J0IGZ1bmN0aW9uIGVmZmVjdChcbiAgY2FsbGJhY2s6IChjdXJyZW50OiB1bmtub3duKSA9PiB1bmtub3duLFxuICBpbml0aWFsVmFsdWU/OiB1bmtub3duLFxuKTogdm9pZCB7XG4gIGlmIChwYXJlbnROb2RlKSB7XG4gICAgY29uc3Qgbm9kZSA9IGNyZWF0ZU5vZGUoaW5pdGlhbFZhbHVlLCBjYWxsYmFjaylcbiAgICBpZiAobm9kZVF1ZXVlKSBub2RlUXVldWUuYWRkKG5vZGUpXG4gICAgZWxzZSBxdWV1ZU1pY3JvdGFzaygoKSA9PiB1cGRhdGVOb2RlKG5vZGUsIGZhbHNlKSlcbiAgfSBlbHNlIHtcbiAgICBxdWV1ZU1pY3JvdGFzaygoKSA9PiBjYWxsYmFjayhpbml0aWFsVmFsdWUpKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbW1lZGlhdGVFZmZlY3Q8VD4oXG4gIGNhbGxiYWNrOiAoY3VycmVudDogVCB8IHVuZGVmaW5lZCkgPT4gVCxcbik6IHZvaWRcbmV4cG9ydCBmdW5jdGlvbiBpbW1lZGlhdGVFZmZlY3Q8VCwgST4oXG4gIGNhbGxiYWNrOiAoY3VycmVudDogSSB8IFQpID0+IFQsXG4gIGluaXRpYWxWYWx1ZTogSSxcbik6IHZvaWRcbmV4cG9ydCBmdW5jdGlvbiBpbW1lZGlhdGVFZmZlY3QoXG4gIGNhbGxiYWNrOiAoY3VycmVudDogdW5rbm93bikgPT4gdW5rbm93bixcbiAgaW5pdGlhbFZhbHVlPzogdW5rbm93bixcbik6IHZvaWQge1xuICBpZiAocGFyZW50Tm9kZSkgdXBkYXRlTm9kZShjcmVhdGVOb2RlKGluaXRpYWxWYWx1ZSwgY2FsbGJhY2spLCBmYWxzZSlcbiAgZWxzZSBjYWxsYmFjayhpbml0aWFsVmFsdWUpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlZDxUPihjYWxsYmFjazogKGN1cnJlbnQ6IFQgfCB1bmRlZmluZWQpID0+IFQpOiAoKSA9PiBUXG5leHBvcnQgZnVuY3Rpb24gY29tcHV0ZWQ8VCwgST4oXG4gIGNhbGxiYWNrOiAoY3VycmVudDogSSB8IFQpID0+IFQsXG4gIGluaXRpYWxWYWx1ZTogSSxcbik6ICgpID0+IFRcbmV4cG9ydCBmdW5jdGlvbiBjb21wdXRlZChcbiAgY2FsbGJhY2s6IChjdXJyZW50OiB1bmtub3duIHwgdW5kZWZpbmVkKSA9PiB1bmtub3duLFxuICBpbml0aWFsVmFsdWU/OiB1bmtub3duLFxuKTogKGN1cnJlbnQ6IHVua25vd24pID0+IHVua25vd24ge1xuICBjb25zdCBzb3VyY2UgPSBjcmVhdGVTb3VyY2UoaW5pdGlhbFZhbHVlKVxuICBlZmZlY3QoKCkgPT4gc2V0U291cmNlVmFsdWUoc291cmNlLCBjYWxsYmFjayhzb3VyY2UudmFsdWUhKSkpXG4gIHJldHVybiBnZXRTb3VyY2VWYWx1ZS5iaW5kKHVuZGVmaW5lZCwgc291cmNlKVxufVxuXG5mdW5jdGlvbiBsb29rdXAobm9kZTogTm9kZSB8IHVuZGVmaW5lZCwgaWQ6IHN5bWJvbCk6IGFueSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBub2RlXG4gICAgPyBub2RlLmluamVjdGlvbnMgJiYgaWQgaW4gbm9kZS5pbmplY3Rpb25zXG4gICAgICA/IG5vZGUuaW5qZWN0aW9uc1tpZF1cbiAgICAgIDogbG9va3VwKG5vZGUucGFyZW50Tm9kZSwgaWQpXG4gICAgOiB1bmRlZmluZWRcbn1cblxuZnVuY3Rpb24gY3JlYXRlU291cmNlPFQgPSBhbnk+KCk6IFNvdXJjZTxUIHwgdW5kZWZpbmVkPlxuZnVuY3Rpb24gY3JlYXRlU291cmNlPFQgPSBhbnk+KGluaXRpYWxWYWx1ZTogVCk6IFNvdXJjZTxUPlxuZnVuY3Rpb24gY3JlYXRlU291cmNlKGluaXRpYWxWYWx1ZT86IGFueSk6IFNvdXJjZTxhbnkgfCB1bmRlZmluZWQ+IHtcbiAgcmV0dXJuIHsgdmFsdWU6IGluaXRpYWxWYWx1ZSwgbm9kZXM6IHVuZGVmaW5lZCwgbm9kZVNsb3RzOiB1bmRlZmluZWQgfVxufVxuXG5mdW5jdGlvbiBnZXRTb3VyY2VWYWx1ZTxUID0gYW55Pihzb3VyY2U6IFNvdXJjZTxUPik6IFQge1xuICBpZiAocGFyZW50Tm9kZSAmJiBwYXJlbnROb2RlLmNhbGxiYWNrKSB7XG4gICAgY29uc3Qgc291cmNlU2xvdCA9IHNvdXJjZS5ub2Rlcz8ubGVuZ3RoIHx8IDAsXG4gICAgICBub2RlU2xvdCA9IHBhcmVudE5vZGUuc291cmNlcz8ubGVuZ3RoIHx8IDBcbiAgICBpZiAocGFyZW50Tm9kZS5zb3VyY2VzID09PSB1bmRlZmluZWQpIHtcbiAgICAgIHBhcmVudE5vZGUuc291cmNlcyA9IFtzb3VyY2VdXG4gICAgICBwYXJlbnROb2RlLnNvdXJjZVNsb3RzID0gW3NvdXJjZVNsb3RdXG4gICAgfSBlbHNlIHtcbiAgICAgIHBhcmVudE5vZGUuc291cmNlcy5wdXNoKHNvdXJjZSlcbiAgICAgIHBhcmVudE5vZGUuc291cmNlU2xvdHMhLnB1c2goc291cmNlU2xvdClcbiAgICB9XG4gICAgaWYgKHNvdXJjZS5ub2RlcyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICBzb3VyY2Uubm9kZXMgPSBbcGFyZW50Tm9kZV1cbiAgICAgIHNvdXJjZS5ub2RlU2xvdHMgPSBbbm9kZVNsb3RdXG4gICAgfSBlbHNlIHtcbiAgICAgIHNvdXJjZS5ub2RlcyEucHVzaChwYXJlbnROb2RlKVxuICAgICAgc291cmNlLm5vZGVTbG90cyEucHVzaChub2RlU2xvdClcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHNvdXJjZS52YWx1ZSFcbn1cblxuZnVuY3Rpb24gc2V0U291cmNlVmFsdWU8VCA9IGFueT4oc291cmNlOiBTb3VyY2U8VD4sIHZhbHVlOiBhbnkpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJmdW5jdGlvblwiKSB2YWx1ZSA9IHZhbHVlKHNvdXJjZS52YWx1ZSlcbiAgc291cmNlLnZhbHVlID0gdmFsdWVcbiAgaWYgKHNvdXJjZS5ub2Rlcz8ubGVuZ3RoKSB7XG4gICAgYmF0Y2goKCkgPT4ge1xuICAgICAgZm9yIChjb25zdCBub2RlIG9mIHNvdXJjZS5ub2RlcyEpIHtcbiAgICAgICAgbm9kZVF1ZXVlIS5hZGQobm9kZSlcbiAgICAgIH1cbiAgICB9KVxuICB9XG59XG5cbmZ1bmN0aW9uIHNvdXJjZVZhbHVlPFQgPSBhbnk+KHNvdXJjZTogU291cmNlPFQ+LCB2YWx1ZT86IGFueSk6IFQgfCB2b2lkIHtcbiAgcmV0dXJuIGFyZ3VtZW50cy5sZW5ndGggPT09IDFcbiAgICA/IGdldFNvdXJjZVZhbHVlKHNvdXJjZSlcbiAgICA6IHNldFNvdXJjZVZhbHVlKHNvdXJjZSwgdmFsdWUpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBzaWduYWw8VD4oKTogU2lnbmFsPFQgfCB1bmRlZmluZWQ+XG5leHBvcnQgZnVuY3Rpb24gc2lnbmFsPFQ+KGluaXRpYWxWYWx1ZTogVCk6IFNpZ25hbDxUPlxuZXhwb3J0IGZ1bmN0aW9uIHNpZ25hbChpbml0aWFsVmFsdWU/OiBhbnkpOiBTaWduYWw8YW55IHwgdW5kZWZpbmVkPiB7XG4gIGNvbnN0IHNvdXJjZSA9IGNyZWF0ZVNvdXJjZShpbml0aWFsVmFsdWUpXG4gIHJldHVybiBzb3VyY2VWYWx1ZS5iaW5kKHVuZGVmaW5lZCwgc291cmNlKSBhcyBTaWduYWw8YW55IHwgdW5kZWZpbmVkPlxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVmPFQ+KCk6IFJlZjxUIHwgdW5kZWZpbmVkPlxuZXhwb3J0IGZ1bmN0aW9uIHJlZjxUPihpbml0aWFsVmFsdWU6IFQpOiBSZWY8VD5cbmV4cG9ydCBmdW5jdGlvbiByZWYoaW5pdGlhbFZhbHVlPzogYW55KTogUmVmPGFueSB8IHVuZGVmaW5lZD4ge1xuICBjb25zdCBzb3VyY2UgPSBjcmVhdGVTb3VyY2UoaW5pdGlhbFZhbHVlKVxuICByZXR1cm4ge1xuICAgIGdldCB2YWx1ZSgpIHtcbiAgICAgIHJldHVybiBnZXRTb3VyY2VWYWx1ZShzb3VyY2UpXG4gICAgfSxcbiAgICBzZXQgdmFsdWUobmV4dFZhbHVlKSB7XG4gICAgICBzZXRTb3VyY2VWYWx1ZShzb3VyY2UsIG5leHRWYWx1ZSlcbiAgICB9LFxuICB9XG59XG5cbmZ1bmN0aW9uIGhhbmRsZUVycm9yKGVycm9yOiBhbnkpOiB2b2lkIHtcbiAgY29uc3QgZXJyb3JDYWxsYmFja3M6ICgoZXJyOiBhbnkpID0+IHZvaWQpW10gPSBsb29rdXAocGFyZW50Tm9kZSwgRXJyb3IpXG4gIGlmICghZXJyb3JDYWxsYmFja3MpIHJldHVybiByZXBvcnRFcnJvcihlcnJvcilcbiAgZm9yIChjb25zdCBjYWxsYmFjayBvZiBlcnJvckNhbGxiYWNrcykge1xuICAgIGNhbGxiYWNrKGVycm9yKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvbkVycm9yPFQgPSBhbnk+KGNhbGxiYWNrOiAoZXJyb3I6IFQpID0+IHZvaWQpOiB2b2lkIHtcbiAgaWYgKHBhcmVudE5vZGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuXG4gIGlmIChwYXJlbnROb2RlLmluamVjdGlvbnMgPT09IHVuZGVmaW5lZCkge1xuICAgIHBhcmVudE5vZGUuaW5qZWN0aW9ucyA9IHsgW0Vycm9yXTogW2NhbGxiYWNrXSB9XG4gIH0gZWxzZSB7XG4gICAgcGFyZW50Tm9kZS5pbmplY3Rpb25zW0Vycm9yXS5wdXNoKGNhbGxiYWNrKVxuICB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBvbkNsZWFudXAoY2FsbGJhY2s6ICgpID0+IHZvaWQpOiB2b2lkIHtcbiAgaWYgKHBhcmVudE5vZGUgPT09IHVuZGVmaW5lZCkgcmV0dXJuXG4gIGVsc2UgaWYgKCFwYXJlbnROb2RlLmNsZWFudXBzKSBwYXJlbnROb2RlLmNsZWFudXBzID0gW2NhbGxiYWNrXVxuICBlbHNlIHBhcmVudE5vZGUuY2xlYW51cHMucHVzaChjYWxsYmFjaylcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHVudHJhY2s8VD4oY2FsbGJhY2s6ICgpID0+IFQpOiBUIHtcbiAgY29uc3Qgbm9kZSA9IHBhcmVudE5vZGVcbiAgcGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuICBjb25zdCByZXN1bHQgPSBjYWxsYmFjaygpXG4gIHBhcmVudE5vZGUgPSBub2RlXG4gIHJldHVybiByZXN1bHRcbn1cblxuZnVuY3Rpb24gYmF0Y2g8VD4oY2FsbGJhY2s6ICgpID0+IFQpOiBUIHtcbiAgaWYgKG5vZGVRdWV1ZSkgcmV0dXJuIGNhbGxiYWNrKClcbiAgbm9kZVF1ZXVlID0gUXVldWVcbiAgY29uc3QgcmVzdWx0ID0gY2FsbGJhY2soKVxuICBxdWV1ZU1pY3JvdGFzayhmbHVzaClcbiAgcmV0dXJuIHJlc3VsdFxufVxuXG5mdW5jdGlvbiBmbHVzaCgpOiB2b2lkIHtcbiAgaWYgKG5vZGVRdWV1ZSA9PT0gdW5kZWZpbmVkKSByZXR1cm5cbiAgZm9yIChjb25zdCBub2RlIG9mIG5vZGVRdWV1ZSkge1xuICAgIG5vZGVRdWV1ZS5kZWxldGUobm9kZSlcbiAgICB1cGRhdGVOb2RlKG5vZGUsIGZhbHNlKVxuICB9XG4gIG5vZGVRdWV1ZSA9IHVuZGVmaW5lZFxufVxuXG5mdW5jdGlvbiB1cGRhdGVOb2RlKG5vZGU6IE5vZGUsIGNvbXBsZXRlOiBib29sZWFuKTogdm9pZCB7XG4gIGNsZWFuTm9kZShub2RlLCBjb21wbGV0ZSlcbiAgaWYgKG5vZGUuY2FsbGJhY2sgPT09IHVuZGVmaW5lZCkgcmV0dXJuXG4gIGNvbnN0IHByZXZpb3VzTm9kZSA9IHBhcmVudE5vZGVcbiAgcGFyZW50Tm9kZSA9IG5vZGVcbiAgdHJ5IHtcbiAgICBub2RlLnZhbHVlID0gbm9kZS5jYWxsYmFjayhub2RlLnZhbHVlKVxuICB9IGNhdGNoIChlcnJvcikge1xuICAgIGhhbmRsZUVycm9yKGVycm9yKVxuICB9IGZpbmFsbHkge1xuICAgIHBhcmVudE5vZGUgPSBwcmV2aW91c05vZGVcbiAgfVxufVxuXG5mdW5jdGlvbiBjbGVhbk5vZGVTb3VyY2VzKG5vZGU6IE5vZGUpOiB2b2lkIHtcbiAgbGV0IHNvdXJjZTogU291cmNlLCBzb3VyY2VTbG90OiBudW1iZXIsIHNvdXJjZU5vZGU6IE5vZGUsIG5vZGVTbG90OiBudW1iZXJcbiAgd2hpbGUgKG5vZGUuc291cmNlcyEubGVuZ3RoKSB7XG4gICAgc291cmNlID0gbm9kZS5zb3VyY2VzIS5wb3AoKSFcbiAgICBzb3VyY2VTbG90ID0gbm9kZS5zb3VyY2VTbG90cyEucG9wKCkhXG4gICAgaWYgKHNvdXJjZS5ub2Rlcz8ubGVuZ3RoKSB7XG4gICAgICBzb3VyY2VOb2RlID0gc291cmNlLm5vZGVzLnBvcCgpIVxuICAgICAgbm9kZVNsb3QgPSBzb3VyY2Uubm9kZVNsb3RzIS5wb3AoKSFcbiAgICAgIGlmIChzb3VyY2VTbG90IDwgc291cmNlLm5vZGVzLmxlbmd0aCkge1xuICAgICAgICBzb3VyY2Uubm9kZXNbc291cmNlU2xvdF0gPSBzb3VyY2VOb2RlXG4gICAgICAgIHNvdXJjZS5ub2RlU2xvdHMhW3NvdXJjZVNsb3RdID0gbm9kZVNsb3RcbiAgICAgICAgc291cmNlTm9kZS5zb3VyY2VTbG90cyFbbm9kZVNsb3RdID0gc291cmNlU2xvdFxuICAgICAgfVxuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBjbGVhbkNoaWxkTm9kZXMobm9kZTogTm9kZSwgY29tcGxldGU6IGJvb2xlYW4pOiB2b2lkIHtcbiAgY29uc3QgaGFzQ2FsbGJhY2sgPSBub2RlLmNhbGxiYWNrICE9PSB1bmRlZmluZWRcbiAgbGV0IGNoaWxkTm9kZTogTm9kZVxuICB3aGlsZSAobm9kZS5jaGlsZHJlbiEubGVuZ3RoKSB7XG4gICAgY2hpbGROb2RlID0gbm9kZS5jaGlsZHJlbiEucG9wKCkhXG4gICAgY2xlYW5Ob2RlKFxuICAgICAgY2hpbGROb2RlLFxuICAgICAgY29tcGxldGUgfHwgKGhhc0NhbGxiYWNrICYmIGNoaWxkTm9kZS5jYWxsYmFjayAhPT0gdW5kZWZpbmVkKSxcbiAgICApXG4gIH1cbn1cblxuZnVuY3Rpb24gY2xlYW5Ob2RlKG5vZGU6IE5vZGUsIGNvbXBsZXRlOiBib29sZWFuKTogdm9pZCB7XG4gIGlmIChub2RlLnNvdXJjZXM/Lmxlbmd0aCkgY2xlYW5Ob2RlU291cmNlcyhub2RlKVxuICBpZiAobm9kZS5jaGlsZHJlbj8ubGVuZ3RoKSBjbGVhbkNoaWxkTm9kZXMobm9kZSwgY29tcGxldGUpXG4gIGlmIChub2RlLmNsZWFudXBzPy5sZW5ndGgpIGNsZWFudXAobm9kZSlcbiAgbm9kZS5pbmplY3Rpb25zID0gdW5kZWZpbmVkXG4gIGlmIChjb21wbGV0ZSkgZGlzcG9zZU5vZGUobm9kZSlcbn1cblxuZnVuY3Rpb24gY2xlYW51cChub2RlOiBOb2RlKTogdm9pZCB7XG4gIHdoaWxlIChub2RlLmNsZWFudXBzPy5sZW5ndGgpIHtcbiAgICBub2RlLmNsZWFudXBzLnBvcCgpISgpXG4gIH1cbn1cblxuZnVuY3Rpb24gZGlzcG9zZU5vZGUobm9kZTogTm9kZSk6IHZvaWQge1xuICBub2RlLnZhbHVlID0gdW5kZWZpbmVkXG4gIG5vZGUucGFyZW50Tm9kZSA9IHVuZGVmaW5lZFxuICBub2RlLmNoaWxkcmVuID0gdW5kZWZpbmVkXG4gIG5vZGUuY2xlYW51cHMgPSB1bmRlZmluZWRcbiAgbm9kZS5jYWxsYmFjayA9IHVuZGVmaW5lZFxuICBub2RlLnNvdXJjZXMgPSB1bmRlZmluZWRcbiAgbm9kZS5zb3VyY2VTbG90cyA9IHVuZGVmaW5lZFxufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5qZWN0aW9uPFQ+KCk6IEluamVjdGlvbjxUIHwgdW5kZWZpbmVkPlxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdGlvbjxUPihkZWZhdWx0VmFsdWU6IFQpOiBJbmplY3Rpb248VD5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3Rpb24oZGVmYXVsdFZhbHVlPzogYW55KTogSW5qZWN0aW9uPGFueSB8IHVuZGVmaW5lZD4ge1xuICByZXR1cm4geyBpZDogU3ltYm9sKCksIGRlZmF1bHRWYWx1ZSB9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm92aWRlPFQsIFI+KFxuICBpbmplY3Rpb246IEluamVjdGlvbjxUPixcbiAgdmFsdWU6IFQsXG4gIGNhbGxiYWNrOiAoKSA9PiBSLFxuKTogUiB7XG4gIHJldHVybiBzY29wZWQoKCkgPT4ge1xuICAgIHBhcmVudE5vZGUhLmluamVjdGlvbnMgPSB7IFtpbmplY3Rpb24uaWRdOiB2YWx1ZSB9XG4gICAgcmV0dXJuIGNhbGxiYWNrKClcbiAgfSkhXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwcm92aWRlcjxUPihpbmplY3Rpb246IEluamVjdGlvbjxUPik6IFByb3ZpZGVyPFQ+IHtcbiAgcmV0dXJuICh2YWx1ZSwgY2FsbGJhY2spID0+IHByb3ZpZGUoaW5qZWN0aW9uLCB2YWx1ZSwgY2FsbGJhY2spXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpbmplY3Q8VD4oaW5qZWN0aW9uOiBJbmplY3Rpb248VD4pOiBUIHtcbiAgcmV0dXJuIGxvb2t1cChwYXJlbnROb2RlLCBpbmplY3Rpb24uaWQpIHx8IGluamVjdGlvbi5kZWZhdWx0VmFsdWVcbn1cbiIsImltcG9ydCB7XG4gIENsZWFudXAsXG4gIGVmZmVjdCxcbiAgc2NvcGVkLFxufSBmcm9tIFwiaHR0cHM6Ly9yYXcuZ2l0aHVidXNlcmNvbnRlbnQuY29tL21pbmktamFpbC9zaWduYWwvbWFpbi9tb2QudHNcIlxuXG5sZXQgcGFyZW50QXR0cnM6IE9iamVjdCB8IHVuZGVmaW5lZFxubGV0IHBhcmVudEZndDogRE9NTm9kZVtdIHwgdW5kZWZpbmVkXG5sZXQgcGFyZW50RWx0OiBET01FbGVtZW50IHwgdW5kZWZpbmVkXG5cbmV4cG9ydCBmdW5jdGlvbiBhdHRyaWJ1dGVzUmVmKCk6XG4gIHwgRWxlbWVudEF0dHJpYnV0ZXMgJiBFdmVudEF0dHJpYnV0ZXM8SFRNTEVsZW1lbnQ+XG4gIHwgdW5kZWZpbmVkXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlc1JlZjxUIGV4dGVuZHMga2V5b2YgSFRNTEVsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwPigpOlxuICB8IEhUTUxFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcFtUXVxuICB8IHVuZGVmaW5lZFxuZXhwb3J0IGZ1bmN0aW9uIGF0dHJpYnV0ZXNSZWY8VCBleHRlbmRzIGtleW9mIFNWR0VsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwPigpOlxuICB8IFNWR0VsZW1lbnRUYWdOYW1lQXR0cmlidXRlTWFwW1RdXG4gIHwgdW5kZWZpbmVkXG5leHBvcnQgZnVuY3Rpb24gYXR0cmlidXRlc1JlZigpOiBPYmplY3QgfCB1bmRlZmluZWQge1xuICBpZiAocGFyZW50RWx0ID09PSB1bmRlZmluZWQpIHJldHVybiB1bmRlZmluZWRcbiAgaWYgKHBhcmVudEF0dHJzID09PSB1bmRlZmluZWQpIHBhcmVudEF0dHJzID0ge31cbiAgcmV0dXJuIHBhcmVudEF0dHJzXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlbGVtZW50UmVmKCk6IEhUTUxFbGVtZW50IHwgdW5kZWZpbmVkXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudFJlZigpOiBTVkdFbGVtZW50IHwgdW5kZWZpbmVkXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudFJlZjxUIGV4dGVuZHMga2V5b2YgSFRNTEVsZW1lbnRUYWdOYW1lTWFwPigpOlxuICB8IEhUTUxFbGVtZW50VGFnTmFtZU1hcFtUXVxuICB8IHVuZGVmaW5lZFxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRSZWY8VCBleHRlbmRzIGtleW9mIFNWR0VsZW1lbnRUYWdOYW1lTWFwPigpOlxuICB8IFNWR0VsZW1lbnRUYWdOYW1lTWFwW1RdXG4gIHwgdW5kZWZpbmVkXG5leHBvcnQgZnVuY3Rpb24gZWxlbWVudFJlZigpOiBIVE1MRWxlbWVudCB8IFNWR0VsZW1lbnQgfCB1bmRlZmluZWQge1xuICByZXR1cm4gcGFyZW50RWx0XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRFbGVtZW50PFQgZXh0ZW5kcyBrZXlvZiBIVE1MRWxlbWVudFRhZ05hbWVBdHRyaWJ1dGVNYXA+KFxuICB0YWdOYW1lOiBULFxuICBjYWxsYmFjaz86IChhdHRyaWJ1dGVzOiBIVE1MRWxlbWVudFRhZ05hbWVBdHRyaWJ1dGVNYXBbVF0pID0+IHZvaWQsXG4pOiB2b2lkIHtcbiAgY29uc3QgZWx0ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCg8c3RyaW5nPiB0YWdOYW1lKVxuICBpZiAoY2FsbGJhY2spIG1vZGlmeSg8RE9NRWxlbWVudD4gZWx0LCBjYWxsYmFjaylcbiAgaW5zZXJ0KGVsdClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFkZEVsZW1lbnROUzxUIGV4dGVuZHMga2V5b2YgU1ZHRWxlbWVudFRhZ05hbWVBdHRyaWJ1dGVNYXA+KFxuICB0YWdOYW1lOiBULFxuICBjYWxsYmFjaz86IChhdHRyaWJ1dGVzOiBTVkdFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcFtUXSkgPT4gdm9pZCxcbik6IHZvaWQge1xuICBjb25zdCBlbHQgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50TlMoXG4gICAgXCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiLFxuICAgIDxzdHJpbmc+IHRhZ05hbWUsXG4gIClcbiAgaWYgKGNhbGxiYWNrKSBtb2RpZnkoPERPTUVsZW1lbnQ+IGVsdCwgY2FsbGJhY2spXG4gIGluc2VydChlbHQpXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhZGRUZXh0KHZhbHVlOiBhbnkpOiB2b2lkIHtcbiAgaW5zZXJ0KGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKFN0cmluZyh2YWx1ZSkpKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVuZGVyKHJvb3RFbHQ6IEhUTUxFbGVtZW50LCBjYWxsYmFjazogKCkgPT4gdm9pZCk6IENsZWFudXAge1xuICByZXR1cm4gc2NvcGVkKChjbGVhbnVwKSA9PiB7XG4gICAgY29uc3QgcHJldmlvdXNFbHQgPSBwYXJlbnRFbHRcbiAgICBwYXJlbnRFbHQgPSA8RE9NRWxlbWVudD4gcm9vdEVsdFxuICAgIGNhbGxiYWNrKClcbiAgICBwYXJlbnRFbHQgPSBwcmV2aW91c0VsdFxuICAgIHJldHVybiBjbGVhbnVwXG4gIH0pIVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdmlldyhjYWxsYmFjazogKCkgPT4gdm9pZCkge1xuICBpZiAocGFyZW50RWx0ID09PSB1bmRlZmluZWQpIHJldHVybiBjYWxsYmFjaygpXG4gIGNvbnN0IGFuY2hvciA9IHBhcmVudEVsdC5hcHBlbmRDaGlsZChuZXcgVGV4dCgpKVxuICBlZmZlY3Q8RE9NTm9kZVtdIHwgdW5kZWZpbmVkPigoY3VycmVudCkgPT4ge1xuICAgIGNvbnN0IG5leHQ6IERPTU5vZGVbXSA9IHBhcmVudEZndCA9IFtdXG4gICAgY2FsbGJhY2soKVxuICAgIHVuaW9uKGFuY2hvciwgY3VycmVudCwgbmV4dClcbiAgICBwYXJlbnRGZ3QgPSB1bmRlZmluZWRcbiAgICByZXR1cm4gbmV4dC5sZW5ndGggPiAwID8gbmV4dCA6IHVuZGVmaW5lZFxuICB9KVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY29tcG9uZW50PFQgZXh0ZW5kcyAoLi4uYXJnczogYW55W10pID0+IGFueT4oXG4gIGNhbGxiYWNrOiBULFxuKTogKC4uLmFyZ3M6IFBhcmFtZXRlcnM8VD4pID0+IFJldHVyblR5cGU8VD4ge1xuICByZXR1cm4gKCguLi5hcmdzKSA9PiBzY29wZWQoKCkgPT4gY2FsbGJhY2soLi4uYXJncykpKVxufVxuXG5mdW5jdGlvbiB1bmlvbihcbiAgYW5jaG9yOiBET01Ob2RlLFxuICBjdXJyZW50OiAoRE9NTm9kZSB8IHVuZGVmaW5lZClbXSB8IHVuZGVmaW5lZCxcbiAgbmV4dDogRE9NTm9kZVtdLFxuKTogdm9pZCB7XG4gIGNvbnN0IGVsdCA9IGFuY2hvci5wYXJlbnROb2RlIVxuICBpZiAoY3VycmVudCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgZm9yIChjb25zdCBub2RlIG9mIG5leHQpIHtcbiAgICAgIGVsdC5pbnNlcnRCZWZvcmUobm9kZSwgYW5jaG9yKVxuICAgIH1cbiAgICByZXR1cm5cbiAgfVxuICBjb25zdCBjdXJyZW50TGVuZ3RoID0gY3VycmVudC5sZW5ndGhcbiAgY29uc3QgbmV4dExlbmd0aCA9IG5leHQubGVuZ3RoXG4gIGxldCBjdXJyZW50Tm9kZTogRE9NTm9kZSB8IHVuZGVmaW5lZCwgaTogbnVtYmVyLCBqOiBudW1iZXJcbiAgb3V0ZXJMb29wOlxuICBmb3IgKGkgPSAwOyBpIDwgbmV4dExlbmd0aDsgaSsrKSB7XG4gICAgY3VycmVudE5vZGUgPSBjdXJyZW50W2ldXG4gICAgZm9yIChqID0gMDsgaiA8IGN1cnJlbnRMZW5ndGg7IGorKykge1xuICAgICAgaWYgKGN1cnJlbnRbal0gPT09IHVuZGVmaW5lZCkgY29udGludWVcbiAgICAgIGVsc2UgaWYgKGN1cnJlbnRbal0hLm5vZGVUeXBlID09PSAzICYmIG5leHRbaV0ubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgaWYgKGN1cnJlbnRbal0hLmRhdGEgIT09IG5leHRbaV0uZGF0YSkgY3VycmVudFtqXSEuZGF0YSA9IG5leHRbaV0uZGF0YVxuICAgICAgICBuZXh0W2ldID0gY3VycmVudFtqXSFcbiAgICAgIH0gZWxzZSBpZiAoY3VycmVudFtqXSEuaXNFcXVhbE5vZGUobmV4dFtpXSkpIG5leHRbaV0gPSBjdXJyZW50W2pdIVxuICAgICAgaWYgKG5leHRbaV0gPT09IGN1cnJlbnRbal0pIHtcbiAgICAgICAgY3VycmVudFtqXSA9IHVuZGVmaW5lZFxuICAgICAgICBpZiAoaSA9PT0gaikgY29udGludWUgb3V0ZXJMb29wXG4gICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgfVxuICAgIGVsdC5pbnNlcnRCZWZvcmUobmV4dFtpXSwgY3VycmVudE5vZGU/Lm5leHRTaWJsaW5nIHx8IG51bGwpXG4gIH1cbiAgd2hpbGUgKGN1cnJlbnQubGVuZ3RoKSBjdXJyZW50LnBvcCgpPy5yZW1vdmUoKVxufVxuXG5mdW5jdGlvbiBxdWFsaWZpZWROYW1lKG5hbWU6IHN0cmluZyk6IHN0cmluZyB7XG4gIHJldHVybiBuYW1lXG4gICAgLnJlcGxhY2UoLyhbQS1aXSkvZywgKG1hdGNoKSA9PiBcIi1cIiArIG1hdGNoWzBdKVxuICAgIC50b0xvd2VyQ2FzZSgpXG59XG5cbmZ1bmN0aW9uIGV2ZW50TmFtZShuYW1lOiBzdHJpbmcpOiBzdHJpbmcge1xuICByZXR1cm4gbmFtZS5zdGFydHNXaXRoKFwib246XCIpID8gbmFtZS5zbGljZSgzKSA6IG5hbWUuc2xpY2UoMikudG9Mb3dlckNhc2UoKVxufVxuXG5mdW5jdGlvbiBvYmplY3RBdHRyaWJ1dGUoZWx0OiBET01FbGVtZW50LCBmaWVsZDogc3RyaW5nLCBvYmplY3Q6IGFueSk6IHZvaWQge1xuICBmb3IgKGNvbnN0IHN1YkZpZWxkIGluIG9iamVjdCkge1xuICAgIGNvbnN0IHZhbHVlID0gb2JqZWN0W3N1YkZpZWxkXVxuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgZWZmZWN0PGFueT4oKHN1YkN1cnIpID0+IHtcbiAgICAgICAgY29uc3Qgc3ViTmV4dCA9IHZhbHVlKClcbiAgICAgICAgaWYgKHN1Yk5leHQgIT09IHN1YkN1cnIpIGVsdFtmaWVsZF1bc3ViRmllbGRdID0gc3ViTmV4dCB8fCBudWxsXG4gICAgICAgIHJldHVybiBzdWJOZXh0XG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICBlbHRbZmllbGRdW3N1YkZpZWxkXSA9IHZhbHVlIHx8IG51bGxcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZHluYW1pY0F0dHJpYnV0ZShcbiAgZWx0OiBET01FbGVtZW50LFxuICBmaWVsZDogc3RyaW5nLFxuICB2YWx1ZTogKCkgPT4gdW5rbm93bixcbik6IHZvaWQge1xuICBlZmZlY3Q8dW5rbm93bj4oKGN1cnJlbnQpID0+IHtcbiAgICBjb25zdCBuZXh0ID0gdmFsdWUoKVxuICAgIGlmIChuZXh0ICE9PSBjdXJyZW50KSBhdHRyaWJ1dGUoZWx0LCBmaWVsZCwgbmV4dClcbiAgICByZXR1cm4gbmV4dFxuICB9KVxufVxuXG5mdW5jdGlvbiBhdHRyaWJ1dGUoZWx0OiBET01FbGVtZW50LCBmaWVsZDogc3RyaW5nLCB2YWx1ZTogdW5rbm93bik6IHZvaWQge1xuICBpZiAodHlwZW9mIHZhbHVlID09PSBcImZ1bmN0aW9uXCIgJiYgIWZpZWxkLnN0YXJ0c1dpdGgoXCJvblwiKSkge1xuICAgIGR5bmFtaWNBdHRyaWJ1dGUoZWx0LCBmaWVsZCwgdmFsdWUgYXMgKCgpID0+IHVua25vd24pKVxuICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gXCJvYmplY3RcIikge1xuICAgIG9iamVjdEF0dHJpYnV0ZShlbHQsIGZpZWxkLCB2YWx1ZSlcbiAgfSBlbHNlIGlmIChmaWVsZCA9PT0gXCJ0ZXh0Q29udGVudFwiKSB7XG4gICAgaWYgKGVsdC5maXJzdENoaWxkPy5ub2RlVHlwZSA9PT0gMykgZWx0LmZpcnN0Q2hpbGQuZGF0YSA9IFN0cmluZyh2YWx1ZSlcbiAgICBlbHNlIGVsdC5wcmVwZW5kKFN0cmluZyh2YWx1ZSkpXG4gIH0gZWxzZSBpZiAoZmllbGQgaW4gZWx0KSB7XG4gICAgZWx0W2ZpZWxkXSA9IHZhbHVlXG4gIH0gZWxzZSBpZiAoZmllbGQuc3RhcnRzV2l0aChcIm9uXCIpKSB7XG4gICAgZWx0LmFkZEV2ZW50TGlzdGVuZXIoZXZlbnROYW1lKGZpZWxkKSwgPEV2ZW50TGlzdGVuZXI+IHZhbHVlKVxuICB9IGVsc2UgaWYgKHZhbHVlICE9IG51bGwpIHtcbiAgICBlbHQuc2V0QXR0cmlidXRlTlMobnVsbCwgcXVhbGlmaWVkTmFtZShmaWVsZCksIFN0cmluZyh2YWx1ZSkpXG4gIH0gZWxzZSB7XG4gICAgZWx0LnJlbW92ZUF0dHJpYnV0ZU5TKG51bGwsIHF1YWxpZmllZE5hbWUoZmllbGQpKVxuICB9XG59XG5cbmZ1bmN0aW9uIGluc2VydChub2RlOiBET01Ob2RlKTogdm9pZCB7XG4gIGlmIChwYXJlbnRFbHQgPT09IHVuZGVmaW5lZCkgcGFyZW50Rmd0Py5wdXNoKG5vZGUpXG4gIGVsc2UgcGFyZW50RWx0Py5hcHBlbmRDaGlsZChub2RlKVxufVxuXG5mdW5jdGlvbiBtb2RpZnkoZWx0OiBET01FbGVtZW50LCBjYWxsYmFjazogKGF0dHJpYnV0ZXM6IGFueSkgPT4gdm9pZCk6IHZvaWQge1xuICBjb25zdCBwcmV2aW91c0VsdCA9IHBhcmVudEVsdFxuICBjb25zdCBwcmV2aW91c0F0dHJzID0gcGFyZW50QXR0cnNcbiAgcGFyZW50RWx0ID0gZWx0XG4gIHBhcmVudEF0dHJzID0gY2FsbGJhY2subGVuZ3RoID8ge30gOiB1bmRlZmluZWRcbiAgY2FsbGJhY2socGFyZW50QXR0cnMpXG4gIHBhcmVudEVsdCA9IHVuZGVmaW5lZFxuICBpZiAocGFyZW50QXR0cnMpIHtcbiAgICBmb3IgKGNvbnN0IGZpZWxkIGluIHBhcmVudEF0dHJzKSB7XG4gICAgICBhdHRyaWJ1dGUoZWx0LCBmaWVsZCwgcGFyZW50QXR0cnNbZmllbGRdKVxuICAgIH1cbiAgfVxuICBwYXJlbnRFbHQgPSBwcmV2aW91c0VsdFxuICBwYXJlbnRBdHRycyA9IHByZXZpb3VzQXR0cnNcbn1cblxudHlwZSBPYmplY3QgPSB7IFtmaWVsZDogc3RyaW5nXTogYW55IH1cbnR5cGUgQWNjZXNzYWJsZTxUPiA9IFQgfCAoKCkgPT4gVClcbnR5cGUgQWNjZXNzYWJsZU9iamVjdDxUPiA9IHsgW0ZpZWxkIGluIGtleW9mIFRdOiBBY2Nlc3NhYmxlPFRbRmllbGRdPiB9XG50eXBlIERPTUVsZW1lbnQgPSAoSFRNTEVsZW1lbnQgfCBTVkdFbGVtZW50KSAmIHsgZmlyc3RDaGlsZDogRE9NTm9kZSB9ICYgT2JqZWN0XG50eXBlIERPTU5vZGUgPSAoTm9kZSB8IERPTUVsZW1lbnQpICYgT2JqZWN0XG50eXBlIEFueVN0cmluZyA9IG9iamVjdCAmIHN0cmluZ1xudHlwZSBCb29sZWFuTGlrZSA9IGJvb2xlYW4gfCBcImZhbHNlXCIgfCBcInRydWVcIlxudHlwZSBOdW1iZXJMaWtlID0gbnVtYmVyIHwgc3RyaW5nXG50eXBlIEhUTUxBdHRyaWJ1dGVSZWZlcnJlclBvbGljeSA9XG4gIHwgXCJuby1yZWZlcnJlclwiXG4gIHwgXCJuby1yZWZlcnJlci13aGVuLWRvd25ncmFkZVwiXG4gIHwgXCJvcmlnaW5cIlxuICB8IFwib3JpZ2luLXdoZW4tY3Jvc3Mtb3JpZ2luXCJcbiAgfCBcInNhbWUtb3JpZ2luXCJcbiAgfCBcInN0cmljdC1vcmlnaW5cIlxuICB8IFwic3RyaWN0LW9yaWdpbi13aGVuLWNyb3NzLW9yaWdpblwiXG4gIHwgXCJ1bnNhZmUtdXJsXCJcbiAgfCBBbnlTdHJpbmdcbnR5cGUgSFRNTElucHV0VHlwZUF0dHJpYnV0ZSA9XG4gIHwgXCJidXR0b25cIlxuICB8IFwiY2hlY2tib3hcIlxuICB8IFwiY29sb3JcIlxuICB8IFwiZGF0ZVwiXG4gIHwgXCJkYXRldGltZS1sb2NhbFwiXG4gIHwgXCJlbWFpbFwiXG4gIHwgXCJmaWxlXCJcbiAgfCBcImhpZGRlblwiXG4gIHwgXCJpbWFnZVwiXG4gIHwgXCJtb250aFwiXG4gIHwgXCJudW1iZXJcIlxuICB8IFwicGFzc3dvcmRcIlxuICB8IFwicmFkaW9cIlxuICB8IFwicmFuZ2VcIlxuICB8IFwicmVzZXRcIlxuICB8IFwic2VhcmNoXCJcbiAgfCBcInN1Ym1pdFwiXG4gIHwgXCJ0ZWxcIlxuICB8IFwidGV4dFwiXG4gIHwgXCJ0aW1lXCJcbiAgfCBcInVybFwiXG4gIHwgXCJ3ZWVrXCJcbiAgfCBBbnlTdHJpbmdcbnR5cGUgQXJpYVJvbGUgPVxuICB8IFwiYWxlcnRcIlxuICB8IFwiYWxlcnRkaWFsb2dcIlxuICB8IFwiYXBwbGljYXRpb25cIlxuICB8IFwiYXJ0aWNsZVwiXG4gIHwgXCJiYW5uZXJcIlxuICB8IFwiYnV0dG9uXCJcbiAgfCBcImNlbGxcIlxuICB8IFwiY2hlY2tib3hcIlxuICB8IFwiY29sdW1uaGVhZGVyXCJcbiAgfCBcImNvbWJvYm94XCJcbiAgfCBcImNvbXBsZW1lbnRhcnlcIlxuICB8IFwiY29udGVudGluZm9cIlxuICB8IFwiZGVmaW5pdGlvblwiXG4gIHwgXCJkaWFsb2dcIlxuICB8IFwiZGlyZWN0b3J5XCJcbiAgfCBcImRvY3VtZW50XCJcbiAgfCBcImZlZWRcIlxuICB8IFwiZmlndXJlXCJcbiAgfCBcImZvcm1cIlxuICB8IFwiZ3JpZFwiXG4gIHwgXCJncmlkY2VsbFwiXG4gIHwgXCJncm91cFwiXG4gIHwgXCJoZWFkaW5nXCJcbiAgfCBcImltZ1wiXG4gIHwgXCJsaW5rXCJcbiAgfCBcImxpc3RcIlxuICB8IFwibGlzdGJveFwiXG4gIHwgXCJsaXN0aXRlbVwiXG4gIHwgXCJsb2dcIlxuICB8IFwibWFpblwiXG4gIHwgXCJtYXJxdWVlXCJcbiAgfCBcIm1hdGhcIlxuICB8IFwibWVudVwiXG4gIHwgXCJtZW51YmFyXCJcbiAgfCBcIm1lbnVpdGVtXCJcbiAgfCBcIm1lbnVpdGVtY2hlY2tib3hcIlxuICB8IFwibWVudWl0ZW1yYWRpb1wiXG4gIHwgXCJuYXZpZ2F0aW9uXCJcbiAgfCBcIm5vbmVcIlxuICB8IFwibm90ZVwiXG4gIHwgXCJvcHRpb25cIlxuICB8IFwicHJlc2VudGF0aW9uXCJcbiAgfCBcInByb2dyZXNzYmFyXCJcbiAgfCBcInJhZGlvXCJcbiAgfCBcInJhZGlvZ3JvdXBcIlxuICB8IFwicmVnaW9uXCJcbiAgfCBcInJvd1wiXG4gIHwgXCJyb3dncm91cFwiXG4gIHwgXCJyb3doZWFkZXJcIlxuICB8IFwic2Nyb2xsYmFyXCJcbiAgfCBcInNlYXJjaFwiXG4gIHwgXCJzZWFyY2hib3hcIlxuICB8IFwic2VwYXJhdG9yXCJcbiAgfCBcInNsaWRlclwiXG4gIHwgXCJzcGluYnV0dG9uXCJcbiAgfCBcInN0YXR1c1wiXG4gIHwgXCJzd2l0Y2hcIlxuICB8IFwidGFiXCJcbiAgfCBcInRhYmxlXCJcbiAgfCBcInRhYmxpc3RcIlxuICB8IFwidGFicGFuZWxcIlxuICB8IFwidGVybVwiXG4gIHwgXCJ0ZXh0Ym94XCJcbiAgfCBcInRpbWVyXCJcbiAgfCBcInRvb2xiYXJcIlxuICB8IFwidG9vbHRpcFwiXG4gIHwgXCJ0cmVlXCJcbiAgfCBcInRyZWVncmlkXCJcbiAgfCBcInRyZWVpdGVtXCJcbiAgfCBBbnlTdHJpbmdcbmRlY2xhcmUgZ2xvYmFsIHtcbiAgaW50ZXJmYWNlIEN1c3RvbUhUTUxFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcCB7fVxufVxuaW50ZXJmYWNlIEhUTUxFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcFxuICBleHRlbmRzIEN1c3RvbUhUTUxFbGVtZW50VGFnTmFtZUF0dHJpYnV0ZU1hcCB7XG4gIGE6IEhUTUxBbmNob3JBdHRyaWJ1dGVzXG4gIGFiYnI6IEhUTUxBYmJyZXZpYXRpb25BdHRyaWJ1dGVzXG4gIGFkZHJlc3M6IEhUTUxBZGRyZXNzQXR0cmlidXRlc1xuICBhcmVhOiBIVE1MQXJlYUF0dHJpYnV0ZXNcbiAgYXJ0aWNsZTogSFRNTEFydGljbGVBdHRyaWJ1dGVzXG4gIGFzaWRlOiBIVE1MQXNpZGVBdHRyaWJ1dGVzXG4gIGF1ZGlvOiBIVE1MQXVkaW9BdHRyaWJ1dGVzXG4gIGI6IEhUTUxBdHRlbnRpb25BdHRyaWJ1dGVzXG4gIGJhc2U6IEhUTUxCYXNlQXR0cmlidXRlc1xuICBiZGk6IEhUTUxCaWRpcmVjdGlvbmFsSXNvbGF0ZUF0dHJpYnV0ZXNcbiAgYmRvOiBIVE1MQmlkaXJlY3Rpb25hbFRleHRPdmVycmlkZUF0dHJpYnV0ZXNcbiAgYmxvY2txdW90ZTogSFRNTFF1b3RlQXR0cmlidXRlc1xuICBib2R5OiBIVE1MQm9keUF0dHJpYnV0ZXNcbiAgYnI6IEhUTUxCUkF0dHJpYnV0ZXNcbiAgYnV0dG9uOiBIVE1MQnV0dG9uQXR0cmlidXRlc1xuICBjYW52YXM6IEhUTUxDYW52YXNBdHRyaWJ1dGVzXG4gIGNhcHRpb246IEhUTUxUYWJsZUNhcHRpb25BdHRyaWJ1dGVzXG4gIGNpdGU6IEhUTUxDaXRhdGlvbkF0dHJpYnV0ZXNcbiAgY29kZTogSFRNTElubGluZUNvZGVBdHRyaWJ1dGVzXG4gIGNvbDogSFRNTFRhYmxlQ29sQXR0cmlidXRlc1xuICBjb2xncm91cDogSFRNTFRhYmxlQ29sQXR0cmlidXRlc1xuICBkYXRhOiBIVE1MRGF0YUF0dHJpYnV0ZXNcbiAgZGF0YWxpc3Q6IEhUTUxEYXRhTGlzdEF0dHJpYnV0ZXNcbiAgZGQ6IEhUTUxEZXNjcmlwdGlvbkRldGFpbHNBdHRyaWJ1dGVzXG4gIGRlbDogSFRNTE1vZEF0dHJpYnV0ZXNcbiAgZGV0YWlsczogSFRNTERldGFpbHNBdHRyaWJ1dGVzXG4gIGRmbjogSFRNTERlZmluaXRpb25BdHRyaWJ1dGVzXG4gIGRpYWxvZzogSFRNTERpYWxvZ0F0dHJpYnV0ZXNcbiAgZGlyOiBIVE1MRGlyZWN0b3J5QXR0cmlidXRlc1xuICBkaXY6IEhUTUxEaXZBdHRyaWJ1dGVzXG4gIGRsOiBIVE1MRExBdHRyaWJ1dGVzXG4gIGR0OiBIVE1MRGVzY3JpcHRpb25UZXJtQXR0cmlidXRlc1xuICBlbTogSFRNTEVtcGhhc2lzQXR0cmlidXRlc1xuICBlbWJlZDogSFRNTEVtYmVkQXR0cmlidXRlc1xuICBmaWVsZHNldDogSFRNTEZpZWxkc2V0QXR0cmlidXRlc1xuICBmaWdjYXB0aW9uOiBIVE1MRmlndXJlQ2FwdGlvbkF0dHJpYnV0ZXNcbiAgZmlndXJlOiBIVE1MRmlndXJlQXR0cmlidXRlc1xuICBmb250OiBIVE1MRm9udEF0dHJpYnV0ZXNcbiAgZm9vdGVyOiBIVE1MRm9vdGVyQXR0cmlidXRlc1xuICBmb3JtOiBIVE1MRm9ybUF0dHJpYnV0ZXNcbiAgZnJhbWU6IEhUTUxGcmFtZUF0dHJpYnV0ZXNcbiAgZnJhbWVzZXQ6IEhUTUxGcmFtZVNldEF0dHJpYnV0ZXNcbiAgaDE6IEhUTUxIZWFkaW5nQXR0cmlidXRlc1xuICBoMjogSFRNTEhlYWRpbmdBdHRyaWJ1dGVzXG4gIGgzOiBIVE1MSGVhZGluZ0F0dHJpYnV0ZXNcbiAgaDQ6IEhUTUxIZWFkaW5nQXR0cmlidXRlc1xuICBoNTogSFRNTEhlYWRpbmdBdHRyaWJ1dGVzXG4gIGg2OiBIVE1MSGVhZGluZ0F0dHJpYnV0ZXNcbiAgaGVhZDogSFRNTEhlYWRBdHRyaWJ1dGVzXG4gIGhlYWRlcjogSFRNTEhlYWRlckF0dHJpYnV0ZXNcbiAgaGdyb3VwOiBIVE1MSGVhZGluZ0dyb3VwQXR0cmlidXRlc1xuICBocjogSFRNTEhSQXR0cmlidXRlc1xuICBodG1sOiBIVE1MSHRtbEF0dHJpYnV0ZXNcbiAgaTogSFRNTElkaW9tYXRpY1RleHRBdHRyaWJ1dGVzXG4gIGlmcmFtZTogSFRNTElGcmFtZUF0dHJpYnV0ZXNcbiAgaW1nOiBIVE1MSW1hZ2VBdHRyaWJ1dGVzXG4gIGlucHV0OiBIVE1MSW5wdXRBdHRyaWJ1dGVzXG4gIGluczogSFRNTE1vZEF0dHJpYnV0ZXNcbiAga2JkOiBIVE1MS2V5Ym9hcmRJbnB1dEF0dHJpYnV0ZXNcbiAgbGFiZWw6IEhUTUxMYWJlbEF0dHJpYnV0ZXNcbiAgbGVnZW5kOiBIVE1MTGVnZW5kQXR0cmlidXRlc1xuICBsaTogSFRNTExJQXR0cmlidXRlc1xuICBsaW5rOiBIVE1MTGlua0F0dHJpYnV0ZXNcbiAgbWFpbjogSFRNTE1haW5BdHRyaWJ1dGVzXG4gIG1hcDogSFRNTE1hcEF0dHJpYnV0ZXNcbiAgbWFyazogSFRNTE1hcmtUZXh0QXR0cmlidXRlc1xuICBtYXJxdWVlOiBIVE1MTWFycXVlZUF0dHJpYnV0ZXNcbiAgbWVudTogSFRNTE1lbnVBdHRyaWJ1dGVzXG4gIG1ldGE6IEhUTUxNZXRhQXR0cmlidXRlc1xuICBtZXRlcjogSFRNTE1ldGVyQXR0cmlidXRlc1xuICBuYXY6IEhUTUxOYXZpZ2F0aW9uU2VjdGlvbkF0dHJpYnV0ZXNcbiAgbm9zY3JpcHQ6IEhUTUxOb1NjcmlwdEF0dHJpYnV0ZXNcbiAgb2JqZWN0OiBIVE1MT2JqZWN0QXR0cmlidXRlc1xuICBvbDogSFRNTE9MaXN0QXR0cmlidXRlc1xuICBvcHRncm91cDogSFRNTE9wdEdyb3VwQXR0cmlidXRlc1xuICBvcHRpb246IEhUTUxPcHRpb25BdHRyaWJ1dGVzXG4gIG91dHB1dDogSFRNTE91dHB1dEF0dHJpYnV0ZXNcbiAgcDogSFRNTFBhcmFncmFwaEF0dHJpYnV0ZXNcbiAgcGFyYW06IEhUTUxQYXJhbUF0dHJpYnV0ZXNcbiAgcGljdHVyZTogSFRNTFBpY3R1cmVBdHRyaWJ1dGVzXG4gIHByZTogSFRNTFByZUF0dHJpYnV0ZXNcbiAgcHJvZ3Jlc3M6IEhUTUxQcm9ncmVzc0F0dHJpYnV0ZXNcbiAgcTogSFRNTFF1b3RlQXR0cmlidXRlc1xuICBycDogSFRNTFJ1YnlGYWxsYmFja1BhcmVudGhlc2lzQXR0cmlidXRlc1xuICBydDogSFRNTFJ1YnlUZXh0QXR0cmlidXRlc1xuICBydWJ5OiBIVE1MUnVieUFubm90YXRpb25BdHRyaWJ1dGVzXG4gIHM6IEhUTUxTdHJpa2VUaHJvdWdoQXR0cmlidXRlc1xuICBzYW1wOiBIVE1MU2FtcGxlT3V0cHV0QXR0cmlidXRlc1xuICBzY3JpcHQ6IEhUTUxTY3JpcHRBdHRyaWJ1dGVzXG4gIHNlY3Rpb246IEhUTUxHZW5lcmljU2VjdGlvbkF0dHJpYnV0ZXNcbiAgc2VsZWN0OiBIVE1MU2VsZWN0QXR0cmlidXRlc1xuICBzbG90OiBIVE1MU2xvdEF0dHJpYnV0ZXNcbiAgc21hbGw6IEhUTUxTaWRlQ29tbWVudEF0dHJpYnV0ZXNcbiAgc291cmNlOiBIVE1MU291cmNlQXR0cmlidXRlc1xuICBzcGFuOiBIVE1MU3BhbkF0dHJpYnV0ZXNcbiAgc3Ryb25nOiBIVE1MU3Ryb25nSW1wb3J0YW5jZUF0dHJpYnV0ZXNcbiAgc3R5bGU6IEhUTUxTdHlsZUF0dHJpYnV0ZXNcbiAgc3ViOiBIVE1MU3Vic2NyaXB0QXR0cmlidXRlc1xuICBzdW1tYXJ5OiBIVE1MRGlzY2xvc3VyZVN1bW1hcnlBdHRyaWJ1dGVzXG4gIHN1cDogSFRNTFN1cGVyc2NyaXB0QXR0cmlidXRlc1xuICB0YWJsZTogSFRNTFRhYmxlQXR0cmlidXRlc1xuICB0Ym9keTogSFRNTFRhYmxlU2VjdGlvbkF0dHJpYnV0ZXNcbiAgdGQ6IEhUTUxUYWJsZVNlY3Rpb25BdHRyaWJ1dGVzPEhUTUxUYWJsZUNlbGxFbGVtZW50PlxuICB0ZW1wbGF0ZTogSFRNTEhlYWRBdHRyaWJ1dGVzXG4gIHRleHRhcmVhOiBIVE1MVGV4dGFyZWFBdHRyaWJ1dGVzXG4gIHRmb290OiBIVE1MVGFibGVTZWN0aW9uQXR0cmlidXRlc1xuICB0aDogSFRNTFRhYmxlQ2VsbEF0dHJpYnV0ZXNcbiAgdGhlYWQ6IEhUTUxUYWJsZVNlY3Rpb25BdHRyaWJ1dGVzXG4gIHRpbWU6IEhUTUxUaW1lQXR0cmlidXRlc1xuICB0aXRsZTogSFRNTFRpdGxlQXR0cmlidXRlc1xuICB0cjogSFRNTFRhYmxlUm93QXR0cmlidXRlc1xuICB0cmFjazogSFRNTFRyYWNrQXR0cmlidXRlc1xuICB1OiBIVE1MVW5kZXJsaW5lQXR0cmlidXRlc1xuICB1bDogSFRNTFVMaXN0QXR0cmlidXRlc1xuICB2YXI6IEhUTUxWYXJpYWJsZUF0dHJpYnV0ZXNcbiAgdmlkZW86IEhUTUxWaWRlb0F0dHJpYnV0ZXNcbiAgd2JyOiBIVE1MTGluZUJyZWFrT3Bwb3J0dW5pdHlBdHRyaWJ1dGVzXG4gIFt0YWdOYW1lOiBzdHJpbmddOiBIVE1MQXR0cmlidXRlczxhbnk+XG59XG5pbnRlcmZhY2UgU1ZHRWxlbWVudFRhZ05hbWVBdHRyaWJ1dGVNYXAge1xuICBhOiBTVkdBdHRyaWJ1dGVzPFNWR0FFbGVtZW50PlxuICBzY3JpcHQ6IFNWR0F0dHJpYnV0ZXM8U1ZHU2NyaXB0RWxlbWVudD5cbiAgc3R5bGU6IFNWR0F0dHJpYnV0ZXM8U1ZHU3R5bGVFbGVtZW50PlxuICB0aXRsZTogU1ZHQXR0cmlidXRlczxTVkdUaXRsZUVsZW1lbnQ+XG4gIGFuaW1hdGU6IFNWR0F0dHJpYnV0ZXM8U1ZHQW5pbWF0ZUVsZW1lbnQ+XG4gIGFuaW1hdGVNb3Rpb246IFNWR0F0dHJpYnV0ZXM8U1ZHQW5pbWF0ZU1vdGlvbkVsZW1lbnQ+XG4gIGFuaW1hdGVUcmFuc2Zvcm06IFNWR0F0dHJpYnV0ZXM8U1ZHQW5pbWF0ZVRyYW5zZm9ybUVsZW1lbnQ+XG4gIGNpcmNsZTogU1ZHQXR0cmlidXRlczxTVkdDaXJjbGVFbGVtZW50PlxuICBjbGlwUGF0aDogU1ZHQXR0cmlidXRlczxTVkdDbGlwUGF0aEVsZW1lbnQ+XG4gIGRlZnM6IFNWR0F0dHJpYnV0ZXM8U1ZHRGVmc0VsZW1lbnQ+XG4gIGRlc2M6IFNWR0F0dHJpYnV0ZXM8U1ZHRGVzY0VsZW1lbnQ+XG4gIGVsbGlwc2U6IFNWR0F0dHJpYnV0ZXM8U1ZHRWxsaXBzZUVsZW1lbnQ+XG4gIGZlQmxlbmQ6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVCbGVuZEVsZW1lbnQ+XG4gIGZlQ29sb3JNYXRyaXg6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVDb2xvck1hdHJpeEVsZW1lbnQ+XG4gIGZlQ29tcG9uZW50VHJhbnNmZXI6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVDb21wb25lbnRUcmFuc2ZlckVsZW1lbnQ+XG4gIGZlQ29tcG9zaXRlOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFQ29tcG9zaXRlRWxlbWVudD5cbiAgZmVDb252b2x2ZU1hdHJpeDogU1ZHQXR0cmlidXRlczxTVkdGRUNvbnZvbHZlTWF0cml4RWxlbWVudD5cbiAgZmVEaWZmdXNlTGlnaHRpbmc6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVEaWZmdXNlTGlnaHRpbmdFbGVtZW50PlxuICBmZURpc3BsYWNlbWVudE1hcDogU1ZHQXR0cmlidXRlczxTVkdGRURpc3BsYWNlbWVudE1hcEVsZW1lbnQ+XG4gIGZlRGlzdGFudExpZ2h0OiBTVkdBdHRyaWJ1dGVzPFNWR0ZFRGlzdGFudExpZ2h0RWxlbWVudD5cbiAgZmVEcm9wU2hhZG93OiBTVkdBdHRyaWJ1dGVzPFNWR0ZFRHJvcFNoYWRvd0VsZW1lbnQ+XG4gIGZlRmxvb2Q6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVGbG9vZEVsZW1lbnQ+XG4gIGZlRnVuY0E6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVGdW5jQUVsZW1lbnQ+XG4gIGZlRnVuY0I6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVGdW5jQkVsZW1lbnQ+XG4gIGZlRnVuY0c6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVGdW5jR0VsZW1lbnQ+XG4gIGZlRnVuY1I6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVGdW5jUkVsZW1lbnQ+XG4gIGZlR2F1c3NpYW5CbHVyOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFR2F1c3NpYW5CbHVyRWxlbWVudD5cbiAgZmVJbWFnZTogU1ZHQXR0cmlidXRlczxTVkdGRUltYWdlRWxlbWVudD5cbiAgZmVNZXJnZTogU1ZHQXR0cmlidXRlczxTVkdGRU1lcmdlRWxlbWVudD5cbiAgZmVNZXJnZU5vZGU6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVNZXJnZU5vZGVFbGVtZW50PlxuICBmZU1vcnBob2xvZ3k6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVNb3JwaG9sb2d5RWxlbWVudD5cbiAgZmVPZmZzZXQ6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVPZmZzZXRFbGVtZW50PlxuICBmZVBvaW50TGlnaHQ6IFNWR0F0dHJpYnV0ZXM8U1ZHRkVQb2ludExpZ2h0RWxlbWVudD5cbiAgZmVTcGVjdWxhckxpZ2h0aW5nOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFU3BlY3VsYXJMaWdodGluZ0VsZW1lbnQ+XG4gIGZlU3BvdExpZ2h0OiBTVkdBdHRyaWJ1dGVzPFNWR0ZFU3BvdExpZ2h0RWxlbWVudD5cbiAgZmVUaWxlOiBTVkdBdHRyaWJ1dGVzPFNWR0ZFVGlsZUVsZW1lbnQ+XG4gIGZlVHVyYnVsZW5jZTogU1ZHQXR0cmlidXRlczxTVkdGRVR1cmJ1bGVuY2VFbGVtZW50PlxuICBmaWx0ZXI6IFNWR0F0dHJpYnV0ZXM8U1ZHRmlsdGVyRWxlbWVudD5cbiAgZm9yZWlnbk9iamVjdDogU1ZHQXR0cmlidXRlczxTVkdGb3JlaWduT2JqZWN0RWxlbWVudD5cbiAgZzogU1ZHQXR0cmlidXRlczxTVkdHRWxlbWVudD5cbiAgaW1hZ2U6IFNWR0F0dHJpYnV0ZXM8U1ZHSW1hZ2VFbGVtZW50PlxuICBsaW5lOiBTVkdBdHRyaWJ1dGVzPFNWR0xpbmVFbGVtZW50PlxuICBsaW5lYXJHcmFkaWVudDogU1ZHQXR0cmlidXRlczxTVkdMaW5lYXJHcmFkaWVudEVsZW1lbnQ+XG4gIG1hcmtlcjogU1ZHQXR0cmlidXRlczxTVkdNYXJrZXJFbGVtZW50PlxuICBtYXNrOiBTVkdBdHRyaWJ1dGVzPFNWR01hc2tFbGVtZW50PlxuICBtZXRhZGF0YTogU1ZHQXR0cmlidXRlczxTVkdNZXRhZGF0YUVsZW1lbnQ+XG4gIG1wYXRoOiBTVkdBdHRyaWJ1dGVzPFNWR01QYXRoRWxlbWVudD5cbiAgcGF0aDogU1ZHQXR0cmlidXRlczxTVkdQYXRoRWxlbWVudD5cbiAgcGF0dGVybjogU1ZHQXR0cmlidXRlczxTVkdQYXR0ZXJuRWxlbWVudD5cbiAgcG9seWdvbjogU1ZHQXR0cmlidXRlczxTVkdQb2x5Z29uRWxlbWVudD5cbiAgcG9seWxpbmU6IFNWR0F0dHJpYnV0ZXM8U1ZHUG9seWxpbmVFbGVtZW50PlxuICByYWRpYWxHcmFkaWVudDogU1ZHQXR0cmlidXRlczxTVkdSYWRpYWxHcmFkaWVudEVsZW1lbnQ+XG4gIHJlY3Q6IFNWR0F0dHJpYnV0ZXM8U1ZHUmVjdEVsZW1lbnQ+XG4gIHNldDogU1ZHQXR0cmlidXRlczxTVkdTZXRFbGVtZW50PlxuICBzdG9wOiBTVkdBdHRyaWJ1dGVzPFNWR1N0b3BFbGVtZW50PlxuICBzdmc6IFNWR0F0dHJpYnV0ZXNcbiAgc3dpdGNoOiBTVkdBdHRyaWJ1dGVzPFNWR1N3aXRjaEVsZW1lbnQ+XG4gIHN5bWJvbDogU1ZHQXR0cmlidXRlczxTVkdTeW1ib2xFbGVtZW50PlxuICB0ZXh0OiBTVkdBdHRyaWJ1dGVzPFNWR1RleHRFbGVtZW50PlxuICB0ZXh0UGF0aDogU1ZHQXR0cmlidXRlczxTVkdUZXh0UGF0aEVsZW1lbnQ+XG4gIHRzcGFuOiBTVkdBdHRyaWJ1dGVzPFNWR1RTcGFuRWxlbWVudD5cbiAgdXNlOiBTVkdBdHRyaWJ1dGVzPFNWR1VzZUVsZW1lbnQ+XG4gIHZpZXc6IFNWR0F0dHJpYnV0ZXM8U1ZHVmlld0VsZW1lbnQ+XG4gIFt0YWdOYW1lOiBzdHJpbmddOiBTVkdBdHRyaWJ1dGVzPGFueT5cbn1cbmludGVyZmFjZSBBcmlhQXR0cmlidXRlcyB7XG4gIHJvbGU6IEFyaWFSb2xlXG4gIGFyaWFBY3RpdmVkZXNjZW5kYW50OiBzdHJpbmdcbiAgYXJpYUF0b21pYzogQm9vbGVhbkxpa2VcbiAgYXJpYUF1dG9jb21wbGV0ZTogc3RyaW5nXG4gIGFyaWFCdXN5OiBCb29sZWFuTGlrZVxuICBhcmlhQ2hlY2tlZDogQm9vbGVhbkxpa2UgfCBcIm1peGVkXCJcbiAgYXJpYUNvbGNvdW50OiBOdW1iZXJMaWtlXG4gIGFyaWFDb2xpbmRleDogTnVtYmVyTGlrZVxuICBhcmlhQ29sc3BhbjogTnVtYmVyTGlrZVxuICBhcmlhQ29udHJvbHM6IHN0cmluZ1xuICBhcmlhQ3VycmVudDogQm9vbGVhbkxpa2UgfCBcInBhZ2VcIiB8IFwic3RlcFwiIHwgXCJsb2NhdGlvblwiIHwgXCJkYXRlXCIgfCBcInRpbWVcIlxuICBhcmlhRGVzY3JpYmVkYnk6IHN0cmluZ1xuICBhcmlhRGV0YWlsczogc3RyaW5nXG4gIGFyaWFEaXNhYmxlZDogQm9vbGVhbkxpa2VcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFyaWFEcm9wZWZmZWN0OiBcIm5vbmVcIiB8IFwiY29weVwiIHwgXCJleGVjdXRlXCIgfCBcImxpbmtcIiB8IFwibW92ZVwiIHwgXCJwb3B1cFwiXG4gIGFyaWFFcnJvcm1lc3NhZ2U6IHN0cmluZ1xuICBhcmlhRXhwYW5kZWQ6IEJvb2xlYW5MaWtlXG4gIGFyaWFGbG93dG86IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYXJpYUdyYWJiZWQ6IEJvb2xlYW5MaWtlXG4gIGFyaWFIYXNwb3B1cDogQm9vbGVhbkxpa2UgfCBcIm1lbnVcIiB8IFwibGlzdGJveFwiIHwgXCJ0cmVlXCIgfCBcImdyaWRcIiB8IFwiZGlhbG9nXCJcbiAgYXJpYUhpZGRlbjogQm9vbGVhbkxpa2VcbiAgYXJpYUludmFsaWQ6IEJvb2xlYW5MaWtlIHwgXCJncmFtbWFyXCIgfCBcInNwZWxsaW5nXCJcbiAgYXJpYUtleXNob3J0Y3V0czogc3RyaW5nXG4gIGFyaWFMYWJlbDogc3RyaW5nXG4gIGFyaWFMYWJlbGxlZGJ5OiBzdHJpbmdcbiAgYXJpYUxldmVsOiBOdW1iZXJMaWtlXG4gIGFyaWFMaXZlOiBcIm9mZlwiIHwgXCJhc3NlcnRpdmVcIiB8IFwicG9saXRlXCJcbiAgYXJpYU1vZGFsOiBCb29sZWFuTGlrZVxuICBhcmlhTXVsdGlsaW5lOiBCb29sZWFuTGlrZVxuICBhcmlhTXVsdGlzZWxlY3RhYmxlOiBCb29sZWFuTGlrZVxuICBhcmlhT3JpZW50YXRpb246IFwiaG9yaXpvbnRhbFwiIHwgXCJ2ZXJ0aWNhbFwiXG4gIGFyaWFPd25zOiBzdHJpbmdcbiAgYXJpYVBsYWNlaG9sZGVyOiBzdHJpbmdcbiAgYXJpYVBvc2luc2V0OiBOdW1iZXJMaWtlXG4gIGFyaWFQcmVzc2VkOiBCb29sZWFuTGlrZSB8IFwibWl4ZWRcIlxuICBhcmlhUmVhZG9ubHk6IEJvb2xlYW5MaWtlXG4gIGFyaWFSZWxldmFudDpcbiAgICB8IFwiYWRkaXRpb25zXCJcbiAgICB8IFwiYWRkaXRpb25zIHJlbW92YWxzXCJcbiAgICB8IFwiYWRkaXRpb25zIHRleHRcIlxuICAgIHwgXCJhbGxcIlxuICAgIHwgXCJyZW1vdmFsc1wiXG4gICAgfCBcInJlbW92YWxzIGFkZGl0aW9uc1wiXG4gICAgfCBcInJlbW92YWxzIHRleHRcIlxuICAgIHwgXCJ0ZXh0XCJcbiAgICB8IFwidGV4dCBhZGRpdGlvbnNcIlxuICAgIHwgXCJ0ZXh0IHJlbW92YWxzXCJcbiAgYXJpYVJlcXVpcmVkOiBCb29sZWFuTGlrZVxuICBhcmlhUm9sZWRlc2NyaXB0aW9uOiBzdHJpbmdcbiAgYXJpYVJvd2NvdW50OiBOdW1iZXJMaWtlXG4gIGFyaWFSb3dpbmRleDogTnVtYmVyTGlrZVxuICBhcmlhUm93c3BhbjogTnVtYmVyTGlrZVxuICBhcmlhU2VsZWN0ZWQ6IEJvb2xlYW5MaWtlXG4gIGFyaWFTZXRzaXplOiBOdW1iZXJMaWtlXG4gIGFyaWFTb3J0OiBcIm5vbmVcIiB8IFwiYXNjZW5kaW5nXCIgfCBcImRlc2NlbmRpbmdcIiB8IFwib3RoZXJcIlxuICBhcmlhVmFsdWVtYXg6IE51bWJlckxpa2VcbiAgYXJpYVZhbHVlbWluOiBOdW1iZXJMaWtlXG4gIGFyaWFWYWx1ZW5vdzogTnVtYmVyTGlrZVxuICBhcmlhVmFsdWV0ZXh0OiBzdHJpbmdcbiAgW2FyaWFBdHRyaWJ1dGU6IGBhcmlhJHtDYXBpdGFsaXplPHN0cmluZz59YF06XG4gICAgfCBzdHJpbmdcbiAgICB8IE51bWJlckxpa2VcbiAgICB8IEJvb2xlYW5MaWtlXG4gICAgfCB1bmRlZmluZWRcbn1cbmludGVyZmFjZSBFbGVtZW50QXR0cmlidXRlcyBleHRlbmRzIEFjY2Vzc2FibGVPYmplY3Q8QXJpYUF0dHJpYnV0ZXM+IHtcbiAgaWQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBhdXRvZm9jdXM6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgbm9uY2U6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0YWJJbmRleDogQWNjZXNzYWJsZTxudW1iZXI+XG4gIGNvbnRlbnRFZGl0YWJsZTogQWNjZXNzYWJsZTxCb29sZWFuTGlrZSB8IFwiaW5oZXJpdFwiPlxuICBlbnRlcktleUhpbnQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjbGFzczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGNsYXNzTmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHNsb3Q6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBpbm5lckhUTUw6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0ZXh0Q29udGVudDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGxhbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBpbnB1dE1vZGU6IEFjY2Vzc2FibGU8XG4gICAgfCBcIm5vbmVcIlxuICAgIHwgXCJ0ZXh0XCJcbiAgICB8IFwidGVsXCJcbiAgICB8IFwidXJsXCJcbiAgICB8IFwiZW1haWxcIlxuICAgIHwgXCJudW1lcmljXCJcbiAgICB8IFwiZGVjaW1hbFwiXG4gICAgfCBcInNlYXJjaFwiXG4gICAgfCBBbnlTdHJpbmdcbiAgPlxuICBzdHlsZTogQWNjZXNzYWJsZU9iamVjdDxTdHlsZXM+IHwgQWNjZXNzYWJsZTxzdHJpbmc+IHwgQWNjZXNzYWJsZTxTdHlsZXM+XG4gIFt1bmtub3duQXR0cmlidXRlOiBzdHJpbmddOiBhbnlcbn1cbnR5cGUgRXZlbnRIYW5kbGVyPFQsIEU+ID0gKGV2ZW50OiBFICYgeyBjdXJyZW50VGFyZ2V0OiBUIH0pID0+IHZvaWRcbmludGVyZmFjZSBIVE1MQXR0cmlidXRlczxUID0gSFRNTEVsZW1lbnQ+XG4gIGV4dGVuZHMgRWxlbWVudEF0dHJpYnV0ZXMsIEV2ZW50QXR0cmlidXRlczxUPiB7XG4gIGFjY2Vzc0tleTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRpcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRyYWdnYWJsZTogQWNjZXNzYWJsZTxCb29sZWFuTGlrZT5cbiAgaGlkZGVuOiBBY2Nlc3NhYmxlPEJvb2xlYW5MaWtlPlxuICBpbm5lclRleHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBsYW5nOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3BlbGxjaGVjazogQWNjZXNzYWJsZTxCb29sZWFuTGlrZT5cbiAgdGl0bGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0cmFuc2xhdGU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgaXM6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxBbmNob3JBdHRyaWJ1dGVzXG4gIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEFuY2hvckVsZW1lbnQ+LCBIeXBlcmxpbmtIVE1MQXR0cmlidXRlcyB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaGFyc2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvb3JkczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRvd25sb2FkOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaHJlZmxhbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHBpbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICByZWZlcnJlclBvbGljeTogQWNjZXNzYWJsZTxIVE1MQXR0cmlidXRlUmVmZXJyZXJQb2xpY3k+XG4gIHJlbDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICByZXY6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc2hhcGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0YXJnZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0ZXh0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEFyZWFBdHRyaWJ1dGVzXG4gIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEFyZWFFbGVtZW50PiwgSHlwZXJsaW5rSFRNTEF0dHJpYnV0ZXMge1xuICBhbHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjb29yZHM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkb3dubG9hZDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBub0hyZWY6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcGluZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJlZmVycmVyUG9saWN5OiBBY2Nlc3NhYmxlPEhUTUxBdHRyaWJ1dGVSZWZlcnJlclBvbGljeT5cbiAgcmVsOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc2hhcGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0YXJnZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxBdWRpb0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MTWVkaWFBdHRyaWJ1dGVzPEhUTUxBdWRpb0VsZW1lbnQ+IHt9XG5pbnRlcmZhY2UgSFRNTEJSQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxCUkVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNsZWFyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MQmFzZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MQmFzZUVsZW1lbnQ+IHtcbiAgaHJlZjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHRhcmdldDogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEJvZHlBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEJvZHlFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhTGluazogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBiYWNrZ3JvdW5kOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJnQ29sb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbGluazogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB0ZXh0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZMaW5rOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MQnV0dG9uQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxCdXR0b25FbGVtZW50PiB7XG4gIGRpc2FibGVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGZvcm1BY3Rpb246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBmb3JtRW5jdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZvcm1NZXRob2Q6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBmb3JtTm9WYWxpZGF0ZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICBmb3JtVGFyZ2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTENhbnZhc0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MQ2FudmFzRWxlbWVudD4ge1xuICB3aWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MRExBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTERMaXN0RWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29tcGFjdDogQWNjZXNzYWJsZTxib29sZWFuPlxufVxuaW50ZXJmYWNlIEhUTUxEYXRhQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxEYXRhRWxlbWVudD4ge1xuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTERhdGFMaXN0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxEYXRhTGlzdEVsZW1lbnQ+IHt9XG5pbnRlcmZhY2UgSFRNTERldGFpbHNBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTERldGFpbHNFbGVtZW50PiB7XG4gIG9wZW46IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbn1cbmludGVyZmFjZSBIVE1MRGlhbG9nQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxEaWFsb2dFbGVtZW50PiB7fVxuaW50ZXJmYWNlIEhUTUxEaXJlY3RvcnlBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTERpcmVjdG9yeUVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbXBhY3Q6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbn1cbmludGVyZmFjZSBIVE1MRGl2QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxEaXZFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEVtYmVkQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxFbWJlZEVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaGVpZ2h0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3JjOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTEZpZWxkc2V0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxGaWVsZFNldEVsZW1lbnQ+IHtcbiAgZGlzYWJsZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEZvbnRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEZvbnRFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjb2xvcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBmYWNlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHNpemU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxGb3JtQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxGb3JtRWxlbWVudD4ge1xuICBhY2NlcHRDaGFyc2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgYWN0aW9uOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgYXV0b2NvbXBsZXRlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZW5jb2Rpbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBlbmN0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbWV0aG9kOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIG5vVmFsaWRhdGU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgdGFyZ2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MRnJhbWVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEZyYW1lRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZnJhbWVCb3JkZXI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbG9uZ0Rlc2M6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbWFyZ2luSGVpZ2h0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG1hcmdpbldpZHRoOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbm9SZXNpemU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHNjcm9sbGluZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxGcmFtZVNldEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MRnJhbWVTZXRFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjb2xzOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICByb3dzOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTEhSQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxIUkVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbG9yOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG5vU2hhZGU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHNpemU6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTEhlYWRpbmdBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEhlYWRpbmdFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTEhlYWRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEhlYWRFbGVtZW50PiB7fVxuaW50ZXJmYWNlIEhUTUxIdG1sQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxIdG1sRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdmVyc2lvbjogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSHlwZXJsaW5rSFRNTEF0dHJpYnV0ZXMge1xuICBoYXNoOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaG9zdDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGhvc3RuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaHJlZjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHBhc3N3b3JkOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcGF0aG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwb3J0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcHJvdG9jb2w6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzZWFyY2g6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB1c2VybmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTElGcmFtZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MSUZyYW1lRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBhbGxvdzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGFsbG93RnVsbHNjcmVlbjogQWNjZXNzYWJsZTxib29sZWFuPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZnJhbWVCb3JkZXI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGxvbmdEZXNjOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG1hcmdpbkhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbWFyZ2luV2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJlZmVycmVyUG9saWN5OiBBY2Nlc3NhYmxlPEhUTUxBdHRyaWJ1dGVSZWZlcnJlclBvbGljeT5cbiAgc2Nyb2xsaW5nOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3JjOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3JjZG9jOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MSW1hZ2VBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTEltYWdlRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBhbHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYm9yZGVyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgY3Jvc3NPcmlnaW46IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkZWNvZGluZzogQWNjZXNzYWJsZTxcImFzeW5jXCIgfCBcImF1dG9cIiB8IFwic3luY1wiIHwgQW55U3RyaW5nPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGhzcGFjZTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIGlzTWFwOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGxvYWRpbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbG9uZ0Rlc2M6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbG93c2NyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICByZWZlcnJlclBvbGljeTogQWNjZXNzYWJsZTxIVE1MQXR0cmlidXRlUmVmZXJyZXJQb2xpY3k+XG4gIHNpemVzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3JjOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3Jjc2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdXNlTWFwOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZzcGFjZTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTElucHV0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxJbnB1dEVsZW1lbnQ+IHtcbiAgYWNjZXB0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgYWx0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgYXV0b2NvbXBsZXRlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgY2FwdHVyZTogQWNjZXNzYWJsZTxCb29sZWFuTGlrZT5cbiAgY2hlY2tlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBkZWZhdWx0Q2hlY2tlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBkZWZhdWx0VmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkaXJOYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZGlzYWJsZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgZmlsZXM6IEFjY2Vzc2FibGU8RmlsZUxpc3Q+XG4gIGZvcm1BY3Rpb246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBmb3JtRW5jdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZvcm1NZXRob2Q6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBmb3JtTm9WYWxpZGF0ZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICBmb3JtVGFyZ2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaGVpZ2h0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGluZGV0ZXJtaW5hdGU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgbWF4OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG1heExlbmd0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBtaW46IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbWluTGVuZ3RoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG11bHRpcGxlOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwYXR0ZXJuOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcGxhY2Vob2xkZXI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICByZWFkT25seTogQWNjZXNzYWJsZTxib29sZWFuPlxuICByZXF1aXJlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBzZWxlY3Rpb25EaXJlY3Rpb246IEFjY2Vzc2FibGU8XCJmb3J3YXJkXCIgfCBcImJhY2t3YXJkXCIgfCBcIm5vbmVcIiB8IEFueVN0cmluZz5cbiAgc2VsZWN0aW9uRW5kOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgc2VsZWN0aW9uU3RhcnQ6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICBzaXplOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHNyYzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHN0ZXA6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdHlwZTogQWNjZXNzYWJsZTxIVE1MSW5wdXRUeXBlQXR0cmlidXRlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdXNlTWFwOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB3ZWJraXRkaXJlY3Rvcnk6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MTElBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTExJRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHZhbHVlOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTExhYmVsQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxMYWJlbEVsZW1lbnQ+IHtcbiAgaHRtbEZvcjogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTExlZ2VuZEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MTGVnZW5kRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxMaW5rQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxMaW5rRWxlbWVudD4ge1xuICBhczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaGFyc2V0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgY3Jvc3NPcmlnaW46IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkaXNhYmxlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBocmVmOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaHJlZmxhbmc6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBpbWFnZVNpemVzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaW1hZ2VTcmNzZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBtZWRpYTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJlZmVycmVyUG9saWN5OiBBY2Nlc3NhYmxlPEhUTUxBdHRyaWJ1dGVSZWZlcnJlclBvbGljeT5cbiAgcmVsOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcmV2OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHRhcmdldDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzaGVldDogQWNjZXNzYWJsZTxTdHlsZXM+XG59XG5pbnRlcmZhY2UgSFRNTE1hcEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MTWFwRWxlbWVudD4ge1xuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MTWFycXVlZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MTWFycXVlZUVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJlaGF2aW9yOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJnQ29sb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZGlyZWN0aW9uOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGhlaWdodDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBoc3BhY2U6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbG9vcDogQWNjZXNzYWJsZTxudW1iZXI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzY3JvbGxBbW91bnQ6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc2Nyb2xsRGVsYXk6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdHJ1ZVNwZWVkOiBib29sZWFuXG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2c3BhY2U6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgd2lkdGg6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxNZWRpYUF0dHJpYnV0ZXM8VD4gZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxUPiB7XG4gIGF1dG9wbGF5OiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGNvbnRyb2xzOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIGNyb3NzT3JpZ2luOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgY3VycmVudFRpbWU6IEFjY2Vzc2FibGU8bnVtYmVyPlxuICBkZWZhdWx0TXV0ZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgZGVmYXVsdFBsYXliYWNrUmF0ZTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIGxvb3A6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgbXV0ZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcGxheWJhY2tSYXRlOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgcHJlbG9hZDogQWNjZXNzYWJsZTxcIm5vbmVcIiB8IFwibWV0YWRhdGFcIiB8IFwiYXV0b1wiIHwgQW55U3RyaW5nPlxuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmNPYmplY3Q6IEFjY2Vzc2FibGU8TWVkaWFTdHJlYW0+XG4gIHZvbHVtZTogQWNjZXNzYWJsZTxudW1iZXI+XG59XG5pbnRlcmZhY2UgSFRNTE1lbnVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTE1lbnVFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjb21wYWN0OiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG59XG5pbnRlcmZhY2UgSFRNTE1ldGFBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTE1ldGFFbGVtZW50PiB7XG4gIGNvbnRlbnQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBodHRwRXF1aXY6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHNjaGVtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTE1ldGVyQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxNZXRlckVsZW1lbnQ+IHtcbiAgaGlnaDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBsb3c6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbWF4OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG1pbjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBvcHRpbXVtOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHZhbHVlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MTW9kQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxNb2RFbGVtZW50PiB7XG4gIGNpdGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkYXRlVGltZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTE9MaXN0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxPTGlzdEVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbXBhY3Q6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcmV2ZXJzZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgc3RhcnQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTE9iamVjdEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MT2JqZWN0RWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYXJjaGl2ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBib3JkZXI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY29kZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjb2RlQmFzZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjb2RlVHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRhdGE6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZGVjbGFyZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGhzcGFjZTogQWNjZXNzYWJsZTxudW1iZXI+XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc3RhbmRieTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB1c2VNYXA6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdnNwYWNlOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MT3B0R3JvdXBBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTE9wdEdyb3VwRWxlbWVudD4ge1xuICBkaXNhYmxlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBsYWJlbDogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTE9wdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MT3B0aW9uRWxlbWVudD4ge1xuICBkZWZhdWx0U2VsZWN0ZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgZGlzYWJsZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgbGFiZWw6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzZWxlY3RlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICB0ZXh0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nW10gfCBudW1iZXI+XG59XG5pbnRlcmZhY2UgSFRNTE91dHB1dEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MT3V0cHV0RWxlbWVudD4ge1xuICBkZWZhdWx0VmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxQYXJhZ3JhcGhBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFBhcmFncmFwaEVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MUGFyYW1BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFBhcmFtRWxlbWVudD4ge1xuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB2YWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2YWx1ZVR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxQcmVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFByZUVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHdpZHRoOiBBY2Nlc3NhYmxlPG51bWJlcj5cbn1cbmludGVyZmFjZSBIVE1MUHJvZ3Jlc3NBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFByb2dyZXNzRWxlbWVudD4ge1xuICBtYXg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nW10gfCBudW1iZXI+XG59XG5pbnRlcmZhY2UgSFRNTFF1b3RlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxRdW90ZUVsZW1lbnQ+IHtcbiAgY2l0ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFNjcmlwdEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MU2NyaXB0RWxlbWVudD4ge1xuICBhc3luYzogQWNjZXNzYWJsZTxCb29sZWFuTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNoYXJzZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjcm9zc09yaWdpbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRlZmVyOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBldmVudDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBodG1sRm9yOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgaW50ZWdyaXR5OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbm9Nb2R1bGU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgcmVmZXJyZXJQb2xpY3k6IEFjY2Vzc2FibGU8SFRNTEF0dHJpYnV0ZVJlZmVycmVyUG9saWN5PlxuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0ZXh0OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgdHlwZTogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFNlbGVjdEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MU2VsZWN0RWxlbWVudD4ge1xuICBhdXRvY29tcGxldGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkaXNhYmxlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBsZW5ndGg6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBtdWx0aXBsZTogQWNjZXNzYWJsZTxib29sZWFuPlxuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcmVxdWlyZWQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgc2VsZWN0ZWRJbmRleDogQWNjZXNzYWJsZTxudW1iZXI+XG4gIHNpemU6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxTbG90QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxTbG90RWxlbWVudD4ge1xuICBuYW1lOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MU291cmNlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxTb3VyY2VFbGVtZW50PiB7XG4gIG1lZGlhOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc2l6ZXM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcmNTZXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MU3R5bGVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFN0eWxlRWxlbWVudD4ge1xuICBtZWRpYTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB0eXBlOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MVGFibGVDYXB0aW9uQXR0cmlidXRlc1xuICBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxUYWJsZUNhcHRpb25FbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFRhYmxlQ2VsbEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MVGFibGVDZWxsRWxlbWVudD4ge1xuICBhYmJyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGF4aXM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYmdDb2xvcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjaE9mZjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGNvbFNwYW46IEFjY2Vzc2FibGU8bnVtYmVyPlxuICBoZWFkZXJzOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbm9XcmFwOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIHJvd1NwYW46IEFjY2Vzc2FibGU8bnVtYmVyPlxuICBzY29wZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2QWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgd2lkdGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbn1cbmludGVyZmFjZSBIVE1MVGFibGVDb2xBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFRhYmxlQ29sRWxlbWVudD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2g6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2hPZmY6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBzcGFuOiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZBbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB3aWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxufVxuaW50ZXJmYWNlIEhUTUxUYWJsZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MVGFibGVFbGVtZW50PiB7XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhbGlnbjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBiZ0NvbG9yOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJvcmRlcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjZWxsUGFkZGluZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBjZWxsU3BhY2luZzogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBmcmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBydWxlczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzdW1tYXJ5OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTFRhYmxlUm93QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxUYWJsZVJvd0VsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGJnQ29sb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2g6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2hPZmY6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdkFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MVGFibGVTZWN0aW9uQXR0cmlidXRlczxUID0gSFRNTFRhYmxlU2VjdGlvbkVsZW1lbnQ+XG4gIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8VD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxpZ246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2g6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2hPZmY6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdkFsaWduOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MVGV4dGFyZWFBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFRleHRBcmVhRWxlbWVudD4ge1xuICBhdXRvY29tcGxldGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjb2xzOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGRlZmF1bHRWYWx1ZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGRpck5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBkaXNhYmxlZDogQWNjZXNzYWJsZTxib29sZWFuPlxuICBtYXhMZW5ndGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbWluTGVuZ3RoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG5hbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwbGFjZWhvbGRlcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJlYWRPbmx5OiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIHJlcXVpcmVkOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIHJvd3M6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc2VsZWN0aW9uRGlyZWN0aW9uOiBBY2Nlc3NhYmxlPFwiZm9yd2FyZFwiIHwgXCJiYWNrd2FyZFwiIHwgXCJub25lXCIgfCBBbnlTdHJpbmc+XG4gIHNlbGVjdGlvblN0YXJ0OiBBY2Nlc3NhYmxlPG51bWJlcj5cbiAgdmFsdWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB3cmFwOiBBY2Nlc3NhYmxlPHN0cmluZz5cbn1cbmludGVyZmFjZSBIVE1MVGltZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MVGltZUVsZW1lbnQ+IHtcbiAgZGF0ZVRpbWU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxUaXRsZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MVGl0bGVFbGVtZW50PiB7XG4gIHRleHQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxUcmFja0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlczxIVE1MVHJhY2tFbGVtZW50PiB7XG4gIGRlZmF1bHQ6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAga2luZDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGxhYmVsOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3JjOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgc3JjbGFuZzogQWNjZXNzYWJsZTxzdHJpbmc+XG59XG5pbnRlcmZhY2UgSFRNTFVMaXN0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxVTGlzdEVsZW1lbnQ+IHtcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbXBhY3Q6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxufVxuaW50ZXJmYWNlIEhUTUxWaWRlb0F0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MTWVkaWFBdHRyaWJ1dGVzPEhUTUxWaWRlb0VsZW1lbnQ+IHtcbiAgZGlzYWJsZVBpY3R1cmVJblBpY3R1cmU6IEFjY2Vzc2FibGU8Ym9vbGVhbj5cbiAgaGVpZ2h0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHBsYXlzSW5saW5lOiBBY2Nlc3NhYmxlPGJvb2xlYW4+XG4gIHBvc3RlcjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG59XG5pbnRlcmZhY2UgSFRNTEFiYnJldmlhdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxBZGRyZXNzQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEFydGljbGVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MQXNpZGVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MQXR0ZW50aW9uQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEJpZGlyZWN0aW9uYWxJc29sYXRlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEJpZGlyZWN0aW9uYWxUZXh0T3ZlcnJpZGVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MQ2l0YXRpb25BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MSW5saW5lQ29kZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxEZXNjcmlwdGlvbkRldGFpbHNBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MRGVmaW5pdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxEZXNjcmlwdGlvblRlcm1BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MRW1waGFzaXNBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MRmlndXJlQ2FwdGlvbkF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxGaWd1cmVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MRm9vdGVyQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTEhlYWRlckF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxIZWFkaW5nR3JvdXBBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MSWRpb21hdGljVGV4dEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxLZXlib2FyZElucHV0QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTE1haW5BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MTWFya1RleHRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MTmF2aWdhdGlvblNlY3Rpb25BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MTm9TY3JpcHRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MUnVieUZhbGxiYWNrUGFyZW50aGVzaXNBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MUnVieVRleHRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MUnVieUFubm90YXRpb25BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MU3RyaWtlVGhyb3VnaEF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxTYW1wbGVPdXRwdXRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MR2VuZXJpY1NlY3Rpb25BdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MU2lkZUNvbW1lbnRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MU3Ryb25nSW1wb3J0YW5jZUF0dHJpYnV0ZXMgZXh0ZW5kcyBIVE1MQXR0cmlidXRlcyB7fVxuaW50ZXJmYWNlIEhUTUxTdWJzY3JpcHRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MRGlzY2xvc3VyZVN1bW1hcnlBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MU3VwZXJzY3JpcHRBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXMge31cbmludGVyZmFjZSBIVE1MVW5kZXJsaW5lQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTFZhcmlhYmxlQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTExpbmVCcmVha09wcG9ydHVuaXR5QXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzIHt9XG5pbnRlcmZhY2UgSFRNTFBpY3R1cmVBdHRyaWJ1dGVzIGV4dGVuZHMgSFRNTEF0dHJpYnV0ZXM8SFRNTFBpY3R1cmVFbGVtZW50PiB7fVxuaW50ZXJmYWNlIEhUTUxTcGFuQXR0cmlidXRlcyBleHRlbmRzIEhUTUxBdHRyaWJ1dGVzPEhUTUxTcGFuRWxlbWVudD4ge31cbmludGVyZmFjZSBTVkdBdHRyaWJ1dGVzPFQgPSBTVkdFbGVtZW50PlxuICBleHRlbmRzIEVsZW1lbnRBdHRyaWJ1dGVzLCBFdmVudEF0dHJpYnV0ZXM8VD4ge1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJhY2NlbnQtaGVpZ2h0XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgYWNjdW11bGF0ZTogQWNjZXNzYWJsZTxcIm5vbmVcIiB8IFwic3VtXCI+XG4gIGFkZGl0aXZlOiBBY2Nlc3NhYmxlPFwicmVwbGFjZVwiIHwgXCJzdW1cIj5cbiAgXCJhbGlnbm1lbnQtYmFzZWxpbmVcIjogQWNjZXNzYWJsZTxcbiAgICB8IFwiYXV0b1wiXG4gICAgfCBcImJhc2VsaW5lXCJcbiAgICB8IFwiYmVmb3JlLWVkZ2VcIlxuICAgIHwgXCJ0ZXh0LWJlZm9yZS1lZGdlXCJcbiAgICB8IFwibWlkZGxlXCJcbiAgICB8IFwiY2VudHJhbFwiXG4gICAgfCBcImFmdGVyLWVkZ2VcIlxuICAgIHwgXCJ0ZXh0LWFmdGVyLWVkZ2VcIlxuICAgIHwgXCJpZGVvZ3JhcGhpY1wiXG4gICAgfCBcImFscGhhYmV0aWNcIlxuICAgIHwgXCJoYW5naW5nXCJcbiAgICB8IFwibWF0aGVtYXRpY2FsXCJcbiAgICB8IFwidG9wXCJcbiAgICB8IFwiY2VudGVyXCJcbiAgICB8IFwiYm90dG9tXCJcbiAgPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgYWxwaGFiZXRpYzogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBhbXBsaXR1ZGU6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwiYXJhYmljLWZvcm1cIjogQWNjZXNzYWJsZTxcImluaXRpYWxcIiB8IFwibWVkaWFsXCIgfCBcInRlcm1pbmFsXCIgfCBcImlzb2xhdGVkXCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhc2NlbnQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgYXR0cmlidXRlTmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBhdHRyaWJ1dGVUeXBlOiBBY2Nlc3NhYmxlPFwiQ1NTXCIgfCBcIlhNTFwiIHwgXCJhdXRvXCI+XG4gIGF6aW11dGg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgYmFzZUZyZXF1ZW5jeTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcImJhc2VsaW5lLXNoaWZ0XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZSB8IFwic3ViXCIgfCBcInN1cGVyXCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBiYXNlUHJvZmlsZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBiYm94OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgYmVnaW46IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBiaWFzOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGJ5OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgY2FsY01vZGU6IEFjY2Vzc2FibGU8XCJkaXNjcmV0ZVwiIHwgXCJsaW5lYXJcIiB8IFwicGFjZWRcIiB8IFwic3BsaW5lXCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImNhcC1oZWlnaHRcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgY2xpcDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIFwiY2xpcC1wYXRoXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjbGlwUGF0aFVuaXRzOiBBY2Nlc3NhYmxlPFwidXNlclNwYWNlT25Vc2VcIiB8IFwib2JqZWN0Qm91bmRpbmdCb3hcIj5cbiAgXCJjbGlwLXJ1bGVcIjogQWNjZXNzYWJsZTxcIm5vbnplcm9cIiB8IFwiZXZlbm9kZFwiIHwgXCJpbmhlcml0XCI+XG4gIFwiY29sb3ItaW50ZXJwb2xhdGlvblwiOiBBY2Nlc3NhYmxlPFwiYXV0b1wiIHwgXCJzUkdCXCIgfCBcImxpbmVhclJHQlwiPlxuICBcImNvbG9yLWludGVycG9sYXRpb24tZmlsdGVyc1wiOiBBY2Nlc3NhYmxlPFxuICAgIFwiYXV0b1wiIHwgXCJzUkdCXCIgfCBcImxpbmVhclJHQlwiIHwgXCJpbmhlcml0XCJcbiAgPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJjb2xvci1wcm9maWxlXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJjb2xvci1yZW5kZXJpbmdcIjogQWNjZXNzYWJsZTxcImF1dG9cIiB8IFwib3B0aW1pemVTcGVlZFwiIHwgXCJvcHRpbWl6ZVF1YWxpdHlcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbnRlbnRTY3JpcHRUeXBlOiBBY2Nlc3NhYmxlPGAke3N0cmluZ30vJHtzdHJpbmd9YD5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNvbnRlbnRTdHlsZVR5cGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjdXJzb3I6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBjeDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBjeTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBkOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZGVjZWxlcmF0ZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZGVzY2VudDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBkaWZmdXNlQ29uc3RhbnQ6IEFjY2Vzc2FibGU8XCJsdHJcIiB8IFwicnRsXCI+XG4gIGRpcmVjdGlvbjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBkaXNwbGF5OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZGl2aXNvcjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcImRvbWluYW50LWJhc2VsaW5lXCI6IEFjY2Vzc2FibGU8XG4gICAgfCBcImF1dG9cIlxuICAgIHwgXCJ0ZXh0LWJvdHRvbVwiXG4gICAgfCBcImFscGhhYmV0aWNcIlxuICAgIHwgXCJpZGVvZ3JhcGhpY1wiXG4gICAgfCBcIm1pZGRsZVwiXG4gICAgfCBcImNlbnRyYWxcIlxuICAgIHwgXCJtYXRoZW1hdGljYWxcIlxuICAgIHwgXCJoYW5naW5nXCJcbiAgICB8IFwidGV4dC10b3BcIlxuICA+XG4gIGR1cjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGR4OiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgZHk6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBlZGdlTW9kZTogQWNjZXNzYWJsZTxcImR1cGxpY2F0ZVwiIHwgXCJ3cmFwXCIgfCBcIm5vbmVcIj5cbiAgZWxldmF0aW9uOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImVuYWJsZS1iYWNrZ3JvdW5kXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBlbmQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBleHBvbmVudDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBmaWxsOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJmaWxsLW9wYWNpdHlcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcImZpbGwtcnVsZVwiOiBBY2Nlc3NhYmxlPFwibm9uemVyb1wiIHwgXCJldmVub2RkXCIgfCBcImluaGVyaXRcIj5cbiAgZmlsdGVyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGZpbHRlclJlczogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGZpbHRlclVuaXRzOiBBY2Nlc3NhYmxlPFwidXNlclNwYWNlT25Vc2VcIiB8IFwib2JqZWN0Qm91bmRpbmdCb3hcIj5cbiAgXCJmbG9vZC1jb2xvclwiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJmbG9vZC1vcGFjaXR5XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJmb250LWZhbWlseVwiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJmb250LXNpemVcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcImZvbnQtc2l6ZS1hZGp1c3RcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcImZvbnQtc3RyZXRjaFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwiZm9udC1zdHlsZVwiOiBBY2Nlc3NhYmxlPFwibm9ybWFsXCIgfCBcIml0YWxpY1wiIHwgXCJvYmxpcXVlXCI+XG4gIFwiZm9udC12YXJpYW50XCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcImZvbnQtd2VpZ2h0XCI6IEFjY2Vzc2FibGU8XG4gICAgTnVtYmVyTGlrZSB8IFwibm9ybWFsXCIgfCBcImJvbGRcIiB8IFwiYm9sZGVyXCIgfCBcImxpZ2h0ZXJcIlxuICA+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBmb3JtYXQ6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBmcjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBmcm9tOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGZ4OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGZ5OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBnMTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBnMjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImdseXBoLW5hbWVcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcImdseXBoLW9yaWVudGF0aW9uLWhvcml6b250YWxcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJnbHlwaC1vcmllbnRhdGlvbi12ZXJ0aWNhbFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBnbHlwaFJlZjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBncmFkaWVudFRyYW5zZm9ybTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIGdyYWRpZW50VW5pdHM6IEFjY2Vzc2FibGU8XCJ1c2VyU3BhY2VPblVzZVwiIHwgXCJvYmplY3RCb3VuZGluZ0JveFwiPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgaGFuZ2luZzogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBoZWlnaHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwiaG9yaXotYWR2LXhcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJob3Jpei1vcmlnaW4teFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBpZGVvZ3JhcGhpYzogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcImltYWdlLXJlbmRlcmluZ1wiOiBBY2Nlc3NhYmxlPFwiYXV0b1wiIHwgXCJvcHRpbWl6ZVNwZWVkXCIgfCBcIm9wdGltaXplUXVhbGl0eVwiPlxuICBpbjI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgaW46IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBpbnRlcmNlcHQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgazE6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgazI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgazM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgazQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGs6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAga2VybmVsTWF0cml4OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBrZXJuZWxVbml0TGVuZ3RoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBrZXJuaW5nOiBBY2Nlc3NhYmxlPE51bWJlckxpa2UgfCBcImF1dG9cIj5cbiAga2V5UG9pbnRzOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIGtleVNwbGluZXM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAga2V5VGltZXM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbGVuZ3RoQWRqdXN0OiBBY2Nlc3NhYmxlPFwic3BhY2luZ1wiIHwgXCJzcGFjaW5nQW5kR2x5cGhzXCI+XG4gIFwibGV0dGVyLXNwYWNpbmdcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlIHwgXCJub3JtYWxcIj5cbiAgXCJsaWdodGluZy1jb2xvclwiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbGltaXRpbmdDb25lQW5nbGU6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJtYXJrZXItZW5kXCI6IEFjY2Vzc2FibGU8YHVybCgjJHtzdHJpbmd9KWA+XG4gIG1hcmtlckhlaWdodDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcIm1hcmtlci1taWRcIjogQWNjZXNzYWJsZTxgdXJsKCMke3N0cmluZ30pYD5cbiAgXCJtYXJrZXItc3RhcnRcIjogQWNjZXNzYWJsZTxgdXJsKCMke3N0cmluZ30pYD5cbiAgbWFya2VyVW5pdHM6IEFjY2Vzc2FibGU8XCJ1c2VyU3BhY2VPblVzZVwiIHwgXCJvYmplY3RCb3VuZGluZ0JveFwiPlxuICBtYXJrZXJXaWR0aDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBtYXNrOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgbWFza0NvbnRlbnRVbml0czogQWNjZXNzYWJsZTxcInVzZXJTcGFjZU9uVXNlXCIgfCBcIm9iamVjdEJvdW5kaW5nQm94XCI+XG4gIG1hc2tVbml0czogQWNjZXNzYWJsZTxcInVzZXJTcGFjZU9uVXNlXCIgfCBcIm9iamVjdEJvdW5kaW5nQm94XCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBtYXRoZW1hdGljYWw6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgbWVkaWE6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGV4cGVyaW1lbnRhbCAqL1xuICBtZXRob2Q6IEFjY2Vzc2FibGU8XCJhbGlnblwiIHwgXCJzdHJldGNoXCI+XG4gIG1vZGU6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgbmFtZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIG51bU9jdGF2ZXM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgb2Zmc2V0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIG9wYWNpdHk6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgb3BlcmF0b3I6IEFjY2Vzc2FibGU8XG4gICAgfCBcIm92ZXJcIlxuICAgIHwgXCJpblwiXG4gICAgfCBcIm91dFwiXG4gICAgfCBcImF0b3BcIlxuICAgIHwgXCJ4b3JcIlxuICAgIHwgXCJsaWdodGVyXCJcbiAgICB8IFwiYXJpdGhtZXRpY1wiXG4gICAgfCBcImVyb2RlXCJcbiAgICB8IFwiZGlsYXRlXCJcbiAgPlxuICBvcmRlcjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBvcmllbnQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZSB8IFwiYXV0b1wiIHwgXCJhdXRvLXN0YXJ0LXJldmVyc2VcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIG9yaWVudGF0aW9uOiBBY2Nlc3NhYmxlPFwiaFwiIHwgXCJ2XCI+XG4gIG9yaWdpbjogQWNjZXNzYWJsZTxcImRlZmF1bHRcIj5cbiAgb3ZlcmZsb3c6IEFjY2Vzc2FibGU8XCJ2aXNpYmxlXCIgfCBcImhpZGRlblwiIHwgXCJzY3JvbGxcIiB8IFwiYXV0b1wiPlxuICBcIm92ZXJsaW5lLXBvc2l0aW9uXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJvdmVybGluZS10aGlja25lc3NcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInBhaW50LW9yZGVyXCI6IEFjY2Vzc2FibGU8XCJub3JtYWxcIiB8IFwiZmlsbFwiIHwgXCJzdHJva2VcIiB8IFwibWFya2Vyc1wiPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJwYW5vc2UtMVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHBhdGg6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwYXRoTGVuZ3RoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHBhdHRlcm5Db250ZW50VW5pdHM6IEFjY2Vzc2FibGU8XCJ1c2VyU3BhY2VPblVzZVwiIHwgXCJvYmplY3RCb3VuZGluZ0JveFwiPlxuICBwYXR0ZXJuVHJhbnNmb3JtOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHBhdHRlcm5Vbml0czogQWNjZXNzYWJsZTxcInVzZXJTcGFjZU9uVXNlXCIgfCBcIm9iamVjdEJvdW5kaW5nQm94XCI+XG4gIFwicG9pbnRlci1ldmVudHNcIjogQWNjZXNzYWJsZTxcbiAgICB8IFwiYm91bmRpbmctYm94XCJcbiAgICB8IFwidmlzaWJsZVBhaW50ZWRcIlxuICAgIHwgXCJ2aXNpYmxlRmlsbFwiXG4gICAgfCBcInZpc2libGVTdHJva2VcIlxuICAgIHwgXCJ2aXNpYmxlXCJcbiAgICB8IFwicGFpbnRlZFwiXG4gICAgfCBcImZpbGxcIlxuICAgIHwgXCJzdHJva2VcIlxuICAgIHwgXCJhbGxcIlxuICAgIHwgXCJub25lXCJcbiAgPlxuICBwb2ludHM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBwb2ludHNBdFg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcG9pbnRzQXRZOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHBvaW50c0F0WjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBwcmVzZXJ2ZUFscGhhOiBBY2Nlc3NhYmxlPEJvb2xlYW5MaWtlPlxuICBwcmVzZXJ2ZUFzcGVjdFJhdGlvOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgcHJpbWl0aXZlVW5pdHM6IEFjY2Vzc2FibGU8XCJ1c2VyU3BhY2VPblVzZVwiIHwgXCJvYmplY3RCb3VuZGluZ0JveFwiPlxuICByOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHJhZGl1czogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICByZWZYOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHJlZlk6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJyZW5kZXJpbmctaW50ZW50XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcmVwZWF0Q291bnQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZSB8IFwiaW5kZWZpbml0ZVwiPlxuICByZXBlYXREdXI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZSB8IFwiaW5kZWZpbml0ZVwiPlxuICByZXF1aXJlZEV4dGVuc2lvbnM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHJlcXVpcmVkRmVhdHVyZXM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgcmVzdGFydDogQWNjZXNzYWJsZTxcImFsd2F5c1wiIHwgXCJ3aGVuTm90QWN0aXZlXCIgfCBcIm5ldmVyXCI+XG4gIHJlc3VsdDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHJvdGF0ZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlIHwgXCJhdXRvXCIgfCBcImF1dG8tcmV2ZXJzZVwiPlxuICByeDogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICByeTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzY2FsZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzZWVkOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwic2hhcGUtcmVuZGVyaW5nXCI6IEFjY2Vzc2FibGU8XG4gICAgXCJhdXRvXCIgfCBcIm9wdGltaXplU3BlZWRcIiB8IFwiY3Jpc3BFZGdlc1wiIHwgXCJnZW9tZXRyaWNQcmVjaXNpb25cIlxuICA+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBzbG9wZTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzcGFjaW5nOiBBY2Nlc3NhYmxlPFwiYXV0b1wiIHwgXCJleGFjdFwiPlxuICBzcGVjdWxhckNvbnN0YW50OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHNwZWN1bGFyRXhwb25lbnQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3BlZWQ6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3ByZWFkTWV0aG9kOiBBY2Nlc3NhYmxlPFwicGFkXCIgfCBcInJlZmxlY3RcIiB8IFwicmVwZWF0XCI+XG4gIHN0YXJ0T2Zmc2V0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHN0ZERldmlhdGlvbjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgc3RlbWg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHN0ZW12OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHN0aXRjaFRpbGVzOiBBY2Nlc3NhYmxlPFwibm9TdGl0Y2hcIiB8IFwic3RpdGNoXCI+XG4gIFwic3RvcC1jb2xvclwiOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJzdG9wLW9wYWNpdHlcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInN0cmlrZXRocm91Z2gtcG9zaXRpb25cIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInN0cmlrZXRocm91Z2gtdGhpY2tuZXNzXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHN0cmluZzogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBzdHJva2U6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcInN0cm9rZS1kYXNoYXJyYXlcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInN0cm9rZS1kYXNob2Zmc2V0XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJzdHJva2UtbGluZWNhcFwiOiBBY2Nlc3NhYmxlPFwiYnV0dFwiIHwgXCJyb3VuZFwiIHwgXCJzcXVhcmVcIiB8IFwiaW5oZXJpdFwiPlxuICBcInN0cm9rZS1saW5lam9pblwiOiBBY2Nlc3NhYmxlPFwibWl0ZXJcIiB8IFwicm91bmRcIiB8IFwiYmV2ZWxcIiB8IFwiaW5oZXJpdFwiPlxuICBcInN0cm9rZS1taXRlcmxpbWl0XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJzdHJva2Utb3BhY2l0eVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwic3Ryb2tlLXdpZHRoXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgc3VyZmFjZVNjYWxlOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHN5c3RlbUxhbmd1YWdlOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHRhYmxlVmFsdWVzOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHRhcmdldFg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdGFyZ2V0WTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInRleHQtYW5jaG9yXCI6IEFjY2Vzc2FibGU8XCJzdGFydFwiIHwgXCJtaWRkbGVcIiB8IFwiZW5kXCI+XG4gIFwidGV4dC1kZWNvcmF0aW9uXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICB0ZXh0TGVuZ3RoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIFwidGV4dC1yZW5kZXJpbmdcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB0bzogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB0cmFuc2Zvcm06IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcInRyYW5zZm9ybS1vcmlnaW5cIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIHR5cGU6IEFjY2Vzc2FibGU8XG4gICAgfCBcInRyYW5zbGF0ZVwiXG4gICAgfCBcInNjYWxlXCJcbiAgICB8IFwicm90YXRlXCJcbiAgICB8IFwic2tld1hcIlxuICAgIHwgXCJza2V3WVwiXG4gICAgfCBcIm1hdHJpeFwiXG4gICAgfCBcInNhdHVyYXRlXCJcbiAgICB8IFwiaHVlUm90YXRlXCJcbiAgICB8IFwibHVtaW5hbmNlVG9BbHBoYVwiXG4gICAgfCBcImlkZW50aXR5XCJcbiAgICB8IFwidGFibGVcIlxuICAgIHwgXCJkaXNjcmV0ZVwiXG4gICAgfCBcImxpbmVhclwiXG4gICAgfCBcImdhbW1hXCJcbiAgICB8IFwiZnJhY3RhbE5vaXNlXCJcbiAgICB8IFwidHVyYnVsZW5jZVwiXG4gID5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHUxOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHUyOiBBY2Nlc3NhYmxlPHN0cmluZz5cbiAgXCJ1bmRlcmxpbmUtcG9zaXRpb25cIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcInVuZGVybGluZS10aGlja25lc3NcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgdW5pY29kZTogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIFwidW5pY29kZS1iaWRpXCI6IEFjY2Vzc2FibGU8XG4gICAgfCBcIm5vcm1hbFwiXG4gICAgfCBcImVtYmVkXCJcbiAgICB8IFwiaXNvbGF0ZVwiXG4gICAgfCBcImJpZGktb3ZlcnJpZGVcIlxuICAgIHwgXCJpc29sYXRlLW92ZXJyaWRlXCJcbiAgICB8IFwicGxhaW50ZXh0XCJcbiAgPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ1bmljb2RlLXJhbmdlXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ1bml0cy1wZXItZW1cIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ2LWFscGhhYmV0aWNcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB2YWx1ZXM6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICBcInZlY3Rvci1lZmZlY3RcIjogQWNjZXNzYWJsZTxcbiAgICB8IFwibm9uZVwiXG4gICAgfCBcIm5vbi1zY2FsaW5nLXN0cm9rZVwiXG4gICAgfCBcIm5vbi1zY2FsaW5nLXNpemVcIlxuICAgIHwgXCJub24tcm90YXRpb25cIlxuICAgIHwgXCJmaXhlZC1wb3NpdGlvblwiXG4gID5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHZlcnNpb246IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ2ZXJ0LWFkdi15XCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwidmVydC1vcmlnaW4teFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInZlcnQtb3JpZ2luLXlcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ2LWhhbmdpbmdcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ2LWlkZW9ncmFwaGljXCI6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgdmlld0JveDogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB2aWV3VGFyZ2V0OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHZpc2liaWxpdHk6IEFjY2Vzc2FibGU8XCJ2aXNpYmxlXCIgfCBcImhpZGRlblwiIHwgXCJjb2xsYXBzZVwiPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ2LW1hdGhlbWF0aWNhbFwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHdpZHRoOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICB3aWR0aHM6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgXCJ3b3JkLXNwYWNpbmdcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICBcIndyaXRpbmctbW9kZVwiOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHgxOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHgyOiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHg6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgeENoYW5uZWxTZWxlY3RvcjogQWNjZXNzYWJsZTxcIlJcIiB8IFwiR1wiIHwgXCJCXCIgfCBcIkFcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwieC1oZWlnaHRcIjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4bGluazphY3R1YXRlXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4bGluazphcmNyb2xlXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4bGluazpocmVmXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4bGluazpyb2xlXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4bGluazpzaG93XCI6IEFjY2Vzc2FibGU8XCJuZXdcIiB8IFwicmVwbGFjZVwiIHwgXCJlbWJlZFwiIHwgXCJvdGhlclwiIHwgXCJub25lXCI+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhsaW5rOnRpdGxlXCI6IEFjY2Vzc2FibGU8c3RyaW5nPlxuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgXCJ4bGluazp0eXBlXCI6IEFjY2Vzc2FibGU8XCJzaW1wbGVcIj5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIFwieG1sOmJhc2VcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIFwieG1sOmxhbmdcIjogQWNjZXNzYWJsZTxzdHJpbmc+XG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBcInhtbDpzcGFjZVwiOiBBY2Nlc3NhYmxlPFwiZGVmYXVsdFwiIHwgXCJwcmVzZXJ2ZVwiPlxuICB5MTogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB5MjogQWNjZXNzYWJsZTxOdW1iZXJMaWtlPlxuICB5OiBBY2Nlc3NhYmxlPE51bWJlckxpa2U+XG4gIHlDaGFubmVsU2VsZWN0b3I6IEFjY2Vzc2FibGU8XCJSXCIgfCBcIkdcIiB8IFwiQlwiIHwgXCJBXCI+XG4gIHo6IEFjY2Vzc2FibGU8TnVtYmVyTGlrZT5cbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHpvb21BbmRQYW46IEFjY2Vzc2FibGU8XCJkaXNhYmxlXCIgfCBcIm1hZ25pZnlcIj5cbn1cbmludGVyZmFjZSBTdHlsZXMge1xuICBhY2NlbnRDb2xvcj86IHN0cmluZ1xuICBhbGlnbkNvbnRlbnQ/OiBzdHJpbmdcbiAgYWxpZ25JdGVtcz86IHN0cmluZ1xuICBhbGlnblNlbGY/OiBzdHJpbmdcbiAgYWxpZ25tZW50QmFzZWxpbmU/OiBzdHJpbmdcbiAgYWxsPzogc3RyaW5nXG4gIGFuaW1hdGlvbj86IHN0cmluZ1xuICBhbmltYXRpb25EZWxheT86IHN0cmluZ1xuICBhbmltYXRpb25EaXJlY3Rpb24/OiBzdHJpbmdcbiAgYW5pbWF0aW9uRHVyYXRpb24/OiBzdHJpbmdcbiAgYW5pbWF0aW9uRmlsbE1vZGU/OiBzdHJpbmdcbiAgYW5pbWF0aW9uSXRlcmF0aW9uQ291bnQ/OiBzdHJpbmdcbiAgYW5pbWF0aW9uTmFtZT86IHN0cmluZ1xuICBhbmltYXRpb25QbGF5U3RhdGU/OiBzdHJpbmdcbiAgYW5pbWF0aW9uVGltaW5nRnVuY3Rpb24/OiBzdHJpbmdcbiAgYXBwZWFyYW5jZT86IHN0cmluZ1xuICBhc3BlY3RSYXRpbz86IHN0cmluZ1xuICBiYWNrZmFjZVZpc2liaWxpdHk/OiBzdHJpbmdcbiAgYmFja2dyb3VuZD86IHN0cmluZ1xuICBiYWNrZ3JvdW5kQXR0YWNobWVudD86IHN0cmluZ1xuICBiYWNrZ3JvdW5kQmxlbmRNb2RlPzogc3RyaW5nXG4gIGJhY2tncm91bmRDbGlwPzogc3RyaW5nXG4gIGJhY2tncm91bmRDb2xvcj86IHN0cmluZ1xuICBiYWNrZ3JvdW5kSW1hZ2U/OiBzdHJpbmdcbiAgYmFja2dyb3VuZE9yaWdpbj86IHN0cmluZ1xuICBiYWNrZ3JvdW5kUG9zaXRpb24/OiBzdHJpbmdcbiAgYmFja2dyb3VuZFBvc2l0aW9uWD86IHN0cmluZ1xuICBiYWNrZ3JvdW5kUG9zaXRpb25ZPzogc3RyaW5nXG4gIGJhY2tncm91bmRSZXBlYXQ/OiBzdHJpbmdcbiAgYmFja2dyb3VuZFNpemU/OiBzdHJpbmdcbiAgYmFzZWxpbmVTaGlmdD86IHN0cmluZ1xuICBibG9ja1NpemU/OiBzdHJpbmdcbiAgYm9yZGVyPzogc3RyaW5nXG4gIGJvcmRlckJsb2NrPzogc3RyaW5nXG4gIGJvcmRlckJsb2NrQ29sb3I/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tFbmQ/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tFbmRDb2xvcj86IHN0cmluZ1xuICBib3JkZXJCbG9ja0VuZFN0eWxlPzogc3RyaW5nXG4gIGJvcmRlckJsb2NrRW5kV2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tTdGFydD86IHN0cmluZ1xuICBib3JkZXJCbG9ja1N0YXJ0Q29sb3I/OiBzdHJpbmdcbiAgYm9yZGVyQmxvY2tTdGFydFN0eWxlPzogc3RyaW5nXG4gIGJvcmRlckJsb2NrU3RhcnRXaWR0aD86IHN0cmluZ1xuICBib3JkZXJCbG9ja1N0eWxlPzogc3RyaW5nXG4gIGJvcmRlckJsb2NrV2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVyQm90dG9tPzogc3RyaW5nXG4gIGJvcmRlckJvdHRvbUNvbG9yPzogc3RyaW5nXG4gIGJvcmRlckJvdHRvbUxlZnRSYWRpdXM/OiBzdHJpbmdcbiAgYm9yZGVyQm90dG9tUmlnaHRSYWRpdXM/OiBzdHJpbmdcbiAgYm9yZGVyQm90dG9tU3R5bGU/OiBzdHJpbmdcbiAgYm9yZGVyQm90dG9tV2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVyQ29sbGFwc2U/OiBzdHJpbmdcbiAgYm9yZGVyQ29sb3I/OiBzdHJpbmdcbiAgYm9yZGVyRW5kRW5kUmFkaXVzPzogc3RyaW5nXG4gIGJvcmRlckVuZFN0YXJ0UmFkaXVzPzogc3RyaW5nXG4gIGJvcmRlckltYWdlPzogc3RyaW5nXG4gIGJvcmRlckltYWdlT3V0c2V0Pzogc3RyaW5nXG4gIGJvcmRlckltYWdlUmVwZWF0Pzogc3RyaW5nXG4gIGJvcmRlckltYWdlU2xpY2U/OiBzdHJpbmdcbiAgYm9yZGVySW1hZ2VTb3VyY2U/OiBzdHJpbmdcbiAgYm9yZGVySW1hZ2VXaWR0aD86IHN0cmluZ1xuICBib3JkZXJJbmxpbmU/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lQ29sb3I/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lRW5kPzogc3RyaW5nXG4gIGJvcmRlcklubGluZUVuZENvbG9yPzogc3RyaW5nXG4gIGJvcmRlcklubGluZUVuZFN0eWxlPzogc3RyaW5nXG4gIGJvcmRlcklubGluZUVuZFdpZHRoPzogc3RyaW5nXG4gIGJvcmRlcklubGluZVN0YXJ0Pzogc3RyaW5nXG4gIGJvcmRlcklubGluZVN0YXJ0Q29sb3I/OiBzdHJpbmdcbiAgYm9yZGVySW5saW5lU3RhcnRTdHlsZT86IHN0cmluZ1xuICBib3JkZXJJbmxpbmVTdGFydFdpZHRoPzogc3RyaW5nXG4gIGJvcmRlcklubGluZVN0eWxlPzogc3RyaW5nXG4gIGJvcmRlcklubGluZVdpZHRoPzogc3RyaW5nXG4gIGJvcmRlckxlZnQ/OiBzdHJpbmdcbiAgYm9yZGVyTGVmdENvbG9yPzogc3RyaW5nXG4gIGJvcmRlckxlZnRTdHlsZT86IHN0cmluZ1xuICBib3JkZXJMZWZ0V2lkdGg/OiBzdHJpbmdcbiAgYm9yZGVyUmFkaXVzPzogc3RyaW5nXG4gIGJvcmRlclJpZ2h0Pzogc3RyaW5nXG4gIGJvcmRlclJpZ2h0Q29sb3I/OiBzdHJpbmdcbiAgYm9yZGVyUmlnaHRTdHlsZT86IHN0cmluZ1xuICBib3JkZXJSaWdodFdpZHRoPzogc3RyaW5nXG4gIGJvcmRlclNwYWNpbmc/OiBzdHJpbmdcbiAgYm9yZGVyU3RhcnRFbmRSYWRpdXM/OiBzdHJpbmdcbiAgYm9yZGVyU3RhcnRTdGFydFJhZGl1cz86IHN0cmluZ1xuICBib3JkZXJTdHlsZT86IHN0cmluZ1xuICBib3JkZXJUb3A/OiBzdHJpbmdcbiAgYm9yZGVyVG9wQ29sb3I/OiBzdHJpbmdcbiAgYm9yZGVyVG9wTGVmdFJhZGl1cz86IHN0cmluZ1xuICBib3JkZXJUb3BSaWdodFJhZGl1cz86IHN0cmluZ1xuICBib3JkZXJUb3BTdHlsZT86IHN0cmluZ1xuICBib3JkZXJUb3BXaWR0aD86IHN0cmluZ1xuICBib3JkZXJXaWR0aD86IHN0cmluZ1xuICBib3R0b20/OiBzdHJpbmdcbiAgYm94U2hhZG93Pzogc3RyaW5nXG4gIGJveFNpemluZz86IHN0cmluZ1xuICBicmVha0FmdGVyPzogc3RyaW5nXG4gIGJyZWFrQmVmb3JlPzogc3RyaW5nXG4gIGJyZWFrSW5zaWRlPzogc3RyaW5nXG4gIGNhcHRpb25TaWRlPzogc3RyaW5nXG4gIGNhcmV0Q29sb3I/OiBzdHJpbmdcbiAgY2xlYXI/OiBzdHJpbmdcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGNsaXA/OiBzdHJpbmdcbiAgY2xpcFBhdGg/OiBzdHJpbmdcbiAgY2xpcFJ1bGU/OiBzdHJpbmdcbiAgY29sb3I/OiBzdHJpbmdcbiAgY29sb3JJbnRlcnBvbGF0aW9uPzogc3RyaW5nXG4gIGNvbG9ySW50ZXJwb2xhdGlvbkZpbHRlcnM/OiBzdHJpbmdcbiAgY29sb3JTY2hlbWU/OiBzdHJpbmdcbiAgY29sdW1uQ291bnQ/OiBzdHJpbmdcbiAgY29sdW1uRmlsbD86IHN0cmluZ1xuICBjb2x1bW5HYXA/OiBzdHJpbmdcbiAgY29sdW1uUnVsZT86IHN0cmluZ1xuICBjb2x1bW5SdWxlQ29sb3I/OiBzdHJpbmdcbiAgY29sdW1uUnVsZVN0eWxlPzogc3RyaW5nXG4gIGNvbHVtblJ1bGVXaWR0aD86IHN0cmluZ1xuICBjb2x1bW5TcGFuPzogc3RyaW5nXG4gIGNvbHVtbldpZHRoPzogc3RyaW5nXG4gIGNvbHVtbnM/OiBzdHJpbmdcbiAgY29udGFpbj86IHN0cmluZ1xuICBjb250ZW50Pzogc3RyaW5nXG4gIGNvdW50ZXJJbmNyZW1lbnQ/OiBzdHJpbmdcbiAgY291bnRlclJlc2V0Pzogc3RyaW5nXG4gIGNvdW50ZXJTZXQ/OiBzdHJpbmdcbiAgY3NzRmxvYXQ/OiBzdHJpbmdcbiAgY3NzVGV4dD86IHN0cmluZ1xuICBjdXJzb3I/OiBzdHJpbmdcbiAgZGlyZWN0aW9uPzogc3RyaW5nXG4gIGRpc3BsYXk/OiBzdHJpbmdcbiAgZG9taW5hbnRCYXNlbGluZT86IHN0cmluZ1xuICBlbXB0eUNlbGxzPzogc3RyaW5nXG4gIGZpbGw/OiBzdHJpbmdcbiAgZmlsbE9wYWNpdHk/OiBzdHJpbmdcbiAgZmlsbFJ1bGU/OiBzdHJpbmdcbiAgZmlsdGVyPzogc3RyaW5nXG4gIGZsZXg/OiBzdHJpbmdcbiAgZmxleEJhc2lzPzogc3RyaW5nXG4gIGZsZXhEaXJlY3Rpb24/OiBzdHJpbmdcbiAgZmxleEZsb3c/OiBzdHJpbmdcbiAgZmxleEdyb3c/OiBzdHJpbmdcbiAgZmxleFNocmluaz86IHN0cmluZ1xuICBmbGV4V3JhcD86IHN0cmluZ1xuICBmbG9hdD86IHN0cmluZ1xuICBmbG9vZENvbG9yPzogc3RyaW5nXG4gIGZsb29kT3BhY2l0eT86IHN0cmluZ1xuICBmb250Pzogc3RyaW5nXG4gIGZvbnRGYW1pbHk/OiBzdHJpbmdcbiAgZm9udEZlYXR1cmVTZXR0aW5ncz86IHN0cmluZ1xuICBmb250S2VybmluZz86IHN0cmluZ1xuICBmb250T3B0aWNhbFNpemluZz86IHN0cmluZ1xuICBmb250U2l6ZT86IHN0cmluZ1xuICBmb250U2l6ZUFkanVzdD86IHN0cmluZ1xuICBmb250U3RyZXRjaD86IHN0cmluZ1xuICBmb250U3R5bGU/OiBzdHJpbmdcbiAgZm9udFN5bnRoZXNpcz86IHN0cmluZ1xuICBmb250VmFyaWFudD86IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZm9udFZhcmlhbnRBbHRlcm5hdGVzPzogc3RyaW5nXG4gIGZvbnRWYXJpYW50Q2Fwcz86IHN0cmluZ1xuICBmb250VmFyaWFudEVhc3RBc2lhbj86IHN0cmluZ1xuICBmb250VmFyaWFudExpZ2F0dXJlcz86IHN0cmluZ1xuICBmb250VmFyaWFudE51bWVyaWM/OiBzdHJpbmdcbiAgZm9udFZhcmlhbnRQb3NpdGlvbj86IHN0cmluZ1xuICBmb250VmFyaWF0aW9uU2V0dGluZ3M/OiBzdHJpbmdcbiAgZm9udFdlaWdodD86IHN0cmluZ1xuICBnYXA/OiBzdHJpbmdcbiAgZ3JpZD86IHN0cmluZ1xuICBncmlkQXJlYT86IHN0cmluZ1xuICBncmlkQXV0b0NvbHVtbnM/OiBzdHJpbmdcbiAgZ3JpZEF1dG9GbG93Pzogc3RyaW5nXG4gIGdyaWRBdXRvUm93cz86IHN0cmluZ1xuICBncmlkQ29sdW1uPzogc3RyaW5nXG4gIGdyaWRDb2x1bW5FbmQ/OiBzdHJpbmdcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIGdyaWRDb2x1bW5HYXA/OiBzdHJpbmdcbiAgZ3JpZENvbHVtblN0YXJ0Pzogc3RyaW5nXG4gIC8qKiBAZGVwcmVjYXRlZCAqL1xuICBncmlkR2FwPzogc3RyaW5nXG4gIGdyaWRSb3c/OiBzdHJpbmdcbiAgZ3JpZFJvd0VuZD86IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgZ3JpZFJvd0dhcD86IHN0cmluZ1xuICBncmlkUm93U3RhcnQ/OiBzdHJpbmdcbiAgZ3JpZFRlbXBsYXRlPzogc3RyaW5nXG4gIGdyaWRUZW1wbGF0ZUFyZWFzPzogc3RyaW5nXG4gIGdyaWRUZW1wbGF0ZUNvbHVtbnM/OiBzdHJpbmdcbiAgZ3JpZFRlbXBsYXRlUm93cz86IHN0cmluZ1xuICBoZWlnaHQ/OiBzdHJpbmdcbiAgaHlwaGVucz86IHN0cmluZ1xuICAvKiogQGRlcHJlY2F0ZWQgKi9cbiAgaW1hZ2VPcmllbnRhdGlvbj86IHN0cmluZ1xuICBpbWFnZVJlbmRlcmluZz86IHN0cmluZ1xuICBpbmxpbmVTaXplPzogc3RyaW5nXG4gIGluc2V0Pzogc3RyaW5nXG4gIGluc2V0QmxvY2s/OiBzdHJpbmdcbiAgaW5zZXRCbG9ja0VuZD86IHN0cmluZ1xuICBpbnNldEJsb2NrU3RhcnQ/OiBzdHJpbmdcbiAgaW5zZXRJbmxpbmU/OiBzdHJpbmdcbiAgaW5zZXRJbmxpbmVFbmQ/OiBzdHJpbmdcbiAgaW5zZXRJbmxpbmVTdGFydD86IHN0cmluZ1xuICBpc29sYXRpb24/OiBzdHJpbmdcbiAganVzdGlmeUNvbnRlbnQ/OiBzdHJpbmdcbiAganVzdGlmeUl0ZW1zPzogc3RyaW5nXG4gIGp1c3RpZnlTZWxmPzogc3RyaW5nXG4gIGxlZnQ/OiBzdHJpbmdcbiAgbGV0dGVyU3BhY2luZz86IHN0cmluZ1xuICBsaWdodGluZ0NvbG9yPzogc3RyaW5nXG4gIGxpbmVCcmVhaz86IHN0cmluZ1xuICBsaW5lSGVpZ2h0Pzogc3RyaW5nXG4gIGxpc3RTdHlsZT86IHN0cmluZ1xuICBsaXN0U3R5bGVJbWFnZT86IHN0cmluZ1xuICBsaXN0U3R5bGVQb3NpdGlvbj86IHN0cmluZ1xuICBsaXN0U3R5bGVUeXBlPzogc3RyaW5nXG4gIG1hcmdpbj86IHN0cmluZ1xuICBtYXJnaW5CbG9jaz86IHN0cmluZ1xuICBtYXJnaW5CbG9ja0VuZD86IHN0cmluZ1xuICBtYXJnaW5CbG9ja1N0YXJ0Pzogc3RyaW5nXG4gIG1hcmdpbkJvdHRvbT86IHN0cmluZ1xuICBtYXJnaW5JbmxpbmU/OiBzdHJpbmdcbiAgbWFyZ2luSW5saW5lRW5kPzogc3RyaW5nXG4gIG1hcmdpbklubGluZVN0YXJ0Pzogc3RyaW5nXG4gIG1hcmdpbkxlZnQ/OiBzdHJpbmdcbiAgbWFyZ2luUmlnaHQ/OiBzdHJpbmdcbiAgbWFyZ2luVG9wPzogc3RyaW5nXG4gIG1hcmtlcj86IHN0cmluZ1xuICBtYXJrZXJFbmQ/OiBzdHJpbmdcbiAgbWFya2VyTWlkPzogc3RyaW5nXG4gIG1hcmtlclN0YXJ0Pzogc3RyaW5nXG4gIG1hc2s/OiBzdHJpbmdcbiAgbWFza1R5cGU/OiBzdHJpbmdcbiAgbWF4QmxvY2tTaXplPzogc3RyaW5nXG4gIG1heEhlaWdodD86IHN0cmluZ1xuICBtYXhJbmxpbmVTaXplPzogc3RyaW5nXG4gIG1heFdpZHRoPzogc3RyaW5nXG4gIG1pbkJsb2NrU2l6ZT86IHN0cmluZ1xuICBtaW5IZWlnaHQ/OiBzdHJpbmdcbiAgbWluSW5saW5lU2l6ZT86IHN0cmluZ1xuICBtaW5XaWR0aD86IHN0cmluZ1xuICBtaXhCbGVuZE1vZGU/OiBzdHJpbmdcbiAgb2JqZWN0Rml0Pzogc3RyaW5nXG4gIG9iamVjdFBvc2l0aW9uPzogc3RyaW5nXG4gIG9mZnNldD86IHN0cmluZ1xuICBvZmZzZXRBbmNob3I/OiBzdHJpbmdcbiAgb2Zmc2V0RGlzdGFuY2U/OiBzdHJpbmdcbiAgb2Zmc2V0UGF0aD86IHN0cmluZ1xuICBvZmZzZXRSb3RhdGU/OiBzdHJpbmdcbiAgb3BhY2l0eT86IHN0cmluZ1xuICBvcmRlcj86IHN0cmluZ1xuICBvcnBoYW5zPzogc3RyaW5nXG4gIG91dGxpbmU/OiBzdHJpbmdcbiAgb3V0bGluZUNvbG9yPzogc3RyaW5nXG4gIG91dGxpbmVPZmZzZXQ/OiBzdHJpbmdcbiAgb3V0bGluZVN0eWxlPzogc3RyaW5nXG4gIG91dGxpbmVXaWR0aD86IHN0cmluZ1xuICBvdmVyZmxvdz86IHN0cmluZ1xuICBvdmVyZmxvd0FuY2hvcj86IHN0cmluZ1xuICBvdmVyZmxvd1dyYXA/OiBzdHJpbmdcbiAgb3ZlcmZsb3dYPzogc3RyaW5nXG4gIG92ZXJmbG93WT86IHN0cmluZ1xuICBvdmVyc2Nyb2xsQmVoYXZpb3I/OiBzdHJpbmdcbiAgb3ZlcnNjcm9sbEJlaGF2aW9yQmxvY2s/OiBzdHJpbmdcbiAgb3ZlcnNjcm9sbEJlaGF2aW9ySW5saW5lPzogc3RyaW5nXG4gIG92ZXJzY3JvbGxCZWhhdmlvclg/OiBzdHJpbmdcbiAgb3ZlcnNjcm9sbEJlaGF2aW9yWT86IHN0cmluZ1xuICBwYWRkaW5nPzogc3RyaW5nXG4gIHBhZGRpbmdCbG9jaz86IHN0cmluZ1xuICBwYWRkaW5nQmxvY2tFbmQ/OiBzdHJpbmdcbiAgcGFkZGluZ0Jsb2NrU3RhcnQ/OiBzdHJpbmdcbiAgcGFkZGluZ0JvdHRvbT86IHN0cmluZ1xuICBwYWRkaW5nSW5saW5lPzogc3RyaW5nXG4gIHBhZGRpbmdJbmxpbmVFbmQ/OiBzdHJpbmdcbiAgcGFkZGluZ0lubGluZVN0YXJ0Pzogc3RyaW5nXG4gIHBhZGRpbmdMZWZ0Pzogc3RyaW5nXG4gIHBhZGRpbmdSaWdodD86IHN0cmluZ1xuICBwYWRkaW5nVG9wPzogc3RyaW5nXG4gIHBhZ2VCcmVha0FmdGVyPzogc3RyaW5nXG4gIHBhZ2VCcmVha0JlZm9yZT86IHN0cmluZ1xuICBwYWdlQnJlYWtJbnNpZGU/OiBzdHJpbmdcbiAgcGFpbnRPcmRlcj86IHN0cmluZ1xuICBwZXJzcGVjdGl2ZT86IHN0cmluZ1xuICBwZXJzcGVjdGl2ZU9yaWdpbj86IHN0cmluZ1xuICBwbGFjZUNvbnRlbnQ/OiBzdHJpbmdcbiAgcGxhY2VJdGVtcz86IHN0cmluZ1xuICBwbGFjZVNlbGY/OiBzdHJpbmdcbiAgcG9pbnRlckV2ZW50cz86IHN0cmluZ1xuICBwb3NpdGlvbj86IHN0cmluZ1xuICBxdW90ZXM/OiBzdHJpbmdcbiAgcmVzaXplPzogc3RyaW5nXG4gIHJpZ2h0Pzogc3RyaW5nXG4gIHJvdGF0ZT86IHN0cmluZ1xuICByb3dHYXA/OiBzdHJpbmdcbiAgcnVieVBvc2l0aW9uPzogc3RyaW5nXG4gIHNjYWxlPzogc3RyaW5nXG4gIHNjcm9sbEJlaGF2aW9yPzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbj86IHN0cmluZ1xuICBzY3JvbGxNYXJnaW5CbG9jaz86IHN0cmluZ1xuICBzY3JvbGxNYXJnaW5CbG9ja0VuZD86IHN0cmluZ1xuICBzY3JvbGxNYXJnaW5CbG9ja1N0YXJ0Pzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbkJvdHRvbT86IHN0cmluZ1xuICBzY3JvbGxNYXJnaW5JbmxpbmU/OiBzdHJpbmdcbiAgc2Nyb2xsTWFyZ2luSW5saW5lRW5kPzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbklubGluZVN0YXJ0Pzogc3RyaW5nXG4gIHNjcm9sbE1hcmdpbkxlZnQ/OiBzdHJpbmdcbiAgc2Nyb2xsTWFyZ2luUmlnaHQ/OiBzdHJpbmdcbiAgc2Nyb2xsTWFyZ2luVG9wPzogc3RyaW5nXG4gIHNjcm9sbFBhZGRpbmc/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZ0Jsb2NrPzogc3RyaW5nXG4gIHNjcm9sbFBhZGRpbmdCbG9ja0VuZD86IHN0cmluZ1xuICBzY3JvbGxQYWRkaW5nQmxvY2tTdGFydD86IHN0cmluZ1xuICBzY3JvbGxQYWRkaW5nQm90dG9tPzogc3RyaW5nXG4gIHNjcm9sbFBhZGRpbmdJbmxpbmU/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZ0lubGluZUVuZD86IHN0cmluZ1xuICBzY3JvbGxQYWRkaW5nSW5saW5lU3RhcnQ/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZ0xlZnQ/OiBzdHJpbmdcbiAgc2Nyb2xsUGFkZGluZ1JpZ2h0Pzogc3RyaW5nXG4gIHNjcm9sbFBhZGRpbmdUb3A/OiBzdHJpbmdcbiAgc2Nyb2xsU25hcEFsaWduPzogc3RyaW5nXG4gIHNjcm9sbFNuYXBTdG9wPzogc3RyaW5nXG4gIHNjcm9sbFNuYXBUeXBlPzogc3RyaW5nXG4gIHNoYXBlSW1hZ2VUaHJlc2hvbGQ/OiBzdHJpbmdcbiAgc2hhcGVNYXJnaW4/OiBzdHJpbmdcbiAgc2hhcGVPdXRzaWRlPzogc3RyaW5nXG4gIHNoYXBlUmVuZGVyaW5nPzogc3RyaW5nXG4gIHN0b3BDb2xvcj86IHN0cmluZ1xuICBzdG9wT3BhY2l0eT86IHN0cmluZ1xuICBzdHJva2U/OiBzdHJpbmdcbiAgc3Ryb2tlRGFzaGFycmF5Pzogc3RyaW5nXG4gIHN0cm9rZURhc2hvZmZzZXQ/OiBzdHJpbmdcbiAgc3Ryb2tlTGluZWNhcD86IHN0cmluZ1xuICBzdHJva2VMaW5lam9pbj86IHN0cmluZ1xuICBzdHJva2VNaXRlcmxpbWl0Pzogc3RyaW5nXG4gIHN0cm9rZU9wYWNpdHk/OiBzdHJpbmdcbiAgc3Ryb2tlV2lkdGg/OiBzdHJpbmdcbiAgdGFiU2l6ZT86IHN0cmluZ1xuICB0YWJsZUxheW91dD86IHN0cmluZ1xuICB0ZXh0QWxpZ24/OiBzdHJpbmdcbiAgdGV4dEFsaWduTGFzdD86IHN0cmluZ1xuICB0ZXh0QW5jaG9yPzogc3RyaW5nXG4gIHRleHRDb21iaW5lVXByaWdodD86IHN0cmluZ1xuICB0ZXh0RGVjb3JhdGlvbj86IHN0cmluZ1xuICB0ZXh0RGVjb3JhdGlvbkNvbG9yPzogc3RyaW5nXG4gIHRleHREZWNvcmF0aW9uTGluZT86IHN0cmluZ1xuICB0ZXh0RGVjb3JhdGlvblNraXBJbms/OiBzdHJpbmdcbiAgdGV4dERlY29yYXRpb25TdHlsZT86IHN0cmluZ1xuICB0ZXh0RGVjb3JhdGlvblRoaWNrbmVzcz86IHN0cmluZ1xuICB0ZXh0RW1waGFzaXM/OiBzdHJpbmdcbiAgdGV4dEVtcGhhc2lzQ29sb3I/OiBzdHJpbmdcbiAgdGV4dEVtcGhhc2lzUG9zaXRpb24/OiBzdHJpbmdcbiAgdGV4dEVtcGhhc2lzU3R5bGU/OiBzdHJpbmdcbiAgdGV4dEluZGVudD86IHN0cmluZ1xuICB0ZXh0T3JpZW50YXRpb24/OiBzdHJpbmdcbiAgdGV4dE92ZXJmbG93Pzogc3RyaW5nXG4gIHRleHRSZW5kZXJpbmc/OiBzdHJpbmdcbiAgdGV4dFNoYWRvdz86IHN0cmluZ1xuICB0ZXh0VHJhbnNmb3JtPzogc3RyaW5nXG4gIHRleHRVbmRlcmxpbmVPZmZzZXQ/OiBzdHJpbmdcbiAgdGV4dFVuZGVybGluZVBvc2l0aW9uPzogc3RyaW5nXG4gIHRvcD86IHN0cmluZ1xuICB0b3VjaEFjdGlvbj86IHN0cmluZ1xuICB0cmFuc2Zvcm0/OiBzdHJpbmdcbiAgdHJhbnNmb3JtQm94Pzogc3RyaW5nXG4gIHRyYW5zZm9ybU9yaWdpbj86IHN0cmluZ1xuICB0cmFuc2Zvcm1TdHlsZT86IHN0cmluZ1xuICB0cmFuc2l0aW9uPzogc3RyaW5nXG4gIHRyYW5zaXRpb25EZWxheT86IHN0cmluZ1xuICB0cmFuc2l0aW9uRHVyYXRpb24/OiBzdHJpbmdcbiAgdHJhbnNpdGlvblByb3BlcnR5Pzogc3RyaW5nXG4gIHRyYW5zaXRpb25UaW1pbmdGdW5jdGlvbj86IHN0cmluZ1xuICB0cmFuc2xhdGU/OiBzdHJpbmdcbiAgdW5pY29kZUJpZGk/OiBzdHJpbmdcbiAgdXNlclNlbGVjdD86IHN0cmluZ1xuICB2ZXJ0aWNhbEFsaWduPzogc3RyaW5nXG4gIHZpc2liaWxpdHk/OiBzdHJpbmdcbiAgd2hpdGVTcGFjZT86IHN0cmluZ1xuICB3aWRvd3M/OiBzdHJpbmdcbiAgd2lkdGg/OiBzdHJpbmdcbiAgd2lsbENoYW5nZT86IHN0cmluZ1xuICB3b3JkQnJlYWs/OiBzdHJpbmdcbiAgd29yZFNwYWNpbmc/OiBzdHJpbmdcbiAgLyoqIEBkZXByZWNhdGVkICovXG4gIHdvcmRXcmFwPzogc3RyaW5nXG4gIHdyaXRpbmdNb2RlPzogc3RyaW5nXG4gIHpJbmRleD86IHN0cmluZ1xuICBbZmllbGQ6IHN0cmluZ106IHN0cmluZyB8IHVuZGVmaW5lZFxufVxudHlwZSBPblByZWZpeGVkRXZlbnRBdHRyaWJ1dGVzPFQsIEU+ID0ge1xuICBbZXZlbnROYW1lOiBgb246JHtzdHJpbmd9YF06IEV2ZW50SGFuZGxlcjxULCBFPlxufVxuaW50ZXJmYWNlIEV2ZW50QXR0cmlidXRlczxUPiBleHRlbmRzIE9uUHJlZml4ZWRFdmVudEF0dHJpYnV0ZXM8VCwgRXZlbnQ+IHtcbiAgb25BYm9ydDogRXZlbnRIYW5kbGVyPFQsIFVJRXZlbnQ+XG4gIG9uQW5pbWF0aW9uQ2FuY2VsOiBFdmVudEhhbmRsZXI8VCwgQW5pbWF0aW9uRXZlbnQ+XG4gIG9uQW5pbWF0aW9uRW5kOiBFdmVudEhhbmRsZXI8VCwgQW5pbWF0aW9uRXZlbnQ+XG4gIG9uQW5pbWF0aW9uSXRlcmF0aW9uOiBFdmVudEhhbmRsZXI8VCwgQW5pbWF0aW9uRXZlbnQ+XG4gIG9uQW5pbWF0aW9uU3RhcnQ6IEV2ZW50SGFuZGxlcjxULCBBbmltYXRpb25FdmVudD5cbiAgb25BdXhDbGljazogRXZlbnRIYW5kbGVyPFQsIE1vdXNlRXZlbnQ+XG4gIG9uQmVmb3JlSW5wdXQ6IEV2ZW50SGFuZGxlcjxULCBJbnB1dEV2ZW50PlxuICBvbkJsdXI6IEV2ZW50SGFuZGxlcjxULCBGb2N1c0V2ZW50PlxuICBvbkNhblBsYXk6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25DYW5QbGF5VGhyb3VnaDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkNoYW5nZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkNsaWNrOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25DbG9zZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkNvbXBvc2l0aW9uRW5kOiBFdmVudEhhbmRsZXI8VCwgQ29tcG9zaXRpb25FdmVudD5cbiAgb25Db21wb3NpdGlvblN0YXJ0OiBFdmVudEhhbmRsZXI8VCwgQ29tcG9zaXRpb25FdmVudD5cbiAgb25Db21wb3NpdGlvblVwZGF0ZTogRXZlbnRIYW5kbGVyPFQsIENvbXBvc2l0aW9uRXZlbnQ+XG4gIG9uQ29udGV4dE1lbnU6IEV2ZW50SGFuZGxlcjxULCBNb3VzZUV2ZW50PlxuICBvbkNvcHk6IEV2ZW50SGFuZGxlcjxULCBDbGlwYm9hcmRFdmVudD5cbiAgb25DdWVDaGFuZ2U6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25DdXQ6IEV2ZW50SGFuZGxlcjxULCBDbGlwYm9hcmRFdmVudD5cbiAgb25EYmxDbGljazogRXZlbnRIYW5kbGVyPFQsIE1vdXNlRXZlbnQ+XG4gIG9uRHJhZzogRXZlbnRIYW5kbGVyPFQsIERyYWdFdmVudD5cbiAgb25EcmFnRW5kOiBFdmVudEhhbmRsZXI8VCwgRHJhZ0V2ZW50PlxuICBvbkRyYWdFbnRlcjogRXZlbnRIYW5kbGVyPFQsIERyYWdFdmVudD5cbiAgb25EcmFnTGVhdmU6IEV2ZW50SGFuZGxlcjxULCBEcmFnRXZlbnQ+XG4gIG9uRHJhZ092ZXI6IEV2ZW50SGFuZGxlcjxULCBEcmFnRXZlbnQ+XG4gIG9uRHJhZ1N0YXJ0OiBFdmVudEhhbmRsZXI8VCwgRHJhZ0V2ZW50PlxuICBvbkRyb3A6IEV2ZW50SGFuZGxlcjxULCBEcmFnRXZlbnQ+XG4gIG9uRHVyYXRpb25DaGFuZ2U6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25FbXB0aWVkOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uRW5kZWQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25FcnJvcjogRXZlbnRIYW5kbGVyPFQsIEVycm9yRXZlbnQ+XG4gIG9uRm9jdXM6IEV2ZW50SGFuZGxlcjxULCBGb2N1c0V2ZW50PlxuICBvbkZvY3VzSW46IEV2ZW50SGFuZGxlcjxULCBGb2N1c0V2ZW50PlxuICBvbkZvY3VzT3V0OiBFdmVudEhhbmRsZXI8VCwgRm9jdXNFdmVudD5cbiAgb25Gb3JtRGF0YTogRXZlbnRIYW5kbGVyPFQsIEZvcm1EYXRhRXZlbnQ+XG4gIG9uR290UG9pbnRlckNhcHR1cmU6IEV2ZW50SGFuZGxlcjxULCBQb2ludGVyRXZlbnQ+XG4gIG9uSW5wdXQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25JbnZhbGlkOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uS2V5RG93bjogRXZlbnRIYW5kbGVyPFQsIEtleWJvYXJkRXZlbnQ+XG4gIG9uS2V5UHJlc3M6IEV2ZW50SGFuZGxlcjxULCBLZXlib2FyZEV2ZW50PlxuICBvbktleVVwOiBFdmVudEhhbmRsZXI8VCwgS2V5Ym9hcmRFdmVudD5cbiAgb25Mb2FkOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uTG9hZGVkRGF0YTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbkxvYWRlZE1ldGFkYXRhOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uTG9hZFN0YXJ0OiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uTG9zdFBvaW50ZXJDYXB0dXJlOiBFdmVudEhhbmRsZXI8VCwgUG9pbnRlckV2ZW50PlxuICBvbk1vdXNlRG93bjogRXZlbnRIYW5kbGVyPFQsIE1vdXNlRXZlbnQ+XG4gIG9uTW91c2VFbnRlcjogRXZlbnRIYW5kbGVyPFQsIE1vdXNlRXZlbnQ+XG4gIG9uTW91c2VMZWF2ZTogRXZlbnRIYW5kbGVyPFQsIE1vdXNlRXZlbnQ+XG4gIG9uTW91c2VNb3ZlOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25Nb3VzZU91dDogRXZlbnRIYW5kbGVyPFQsIE1vdXNlRXZlbnQ+XG4gIG9uTW91c2VPdmVyOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25Nb3VzZVVwOiBFdmVudEhhbmRsZXI8VCwgTW91c2VFdmVudD5cbiAgb25QYXVzZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblBhc3RlOiBFdmVudEhhbmRsZXI8VCwgQ2xpcGJvYXJkRXZlbnQ+XG4gIG9uUGxheTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblBsYXlpbmc6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25Qb2ludGVyQ2FuY2VsOiBFdmVudEhhbmRsZXI8VCwgUG9pbnRlckV2ZW50PlxuICBvblBvaW50ZXJEb3duOiBFdmVudEhhbmRsZXI8VCwgUG9pbnRlckV2ZW50PlxuICBvblBvaW50ZXJFbnRlcjogRXZlbnRIYW5kbGVyPFQsIFBvaW50ZXJFdmVudD5cbiAgb25Qb2ludGVyTGVhdmU6IEV2ZW50SGFuZGxlcjxULCBQb2ludGVyRXZlbnQ+XG4gIG9uUG9pbnRlck1vdmU6IEV2ZW50SGFuZGxlcjxULCBQb2ludGVyRXZlbnQ+XG4gIG9uUG9pbnRlck91dDogRXZlbnRIYW5kbGVyPFQsIFBvaW50ZXJFdmVudD5cbiAgb25Qb2ludGVyT3ZlcjogRXZlbnRIYW5kbGVyPFQsIFBvaW50ZXJFdmVudD5cbiAgb25Qb2ludGVyVXA6IEV2ZW50SGFuZGxlcjxULCBQb2ludGVyRXZlbnQ+XG4gIG9uUHJvZ3Jlc3M6IEV2ZW50SGFuZGxlcjxULCBQcm9ncmVzc0V2ZW50PlxuICBvblJhdGVDaGFuZ2U6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25SZXNldDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblJlc2l6ZTogRXZlbnRIYW5kbGVyPFQsIFVJRXZlbnQ+XG4gIG9uU2Nyb2xsOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uU2VjdXJpdHlQb2xpY3lWaW9sYXRpb246IEV2ZW50SGFuZGxlcjxcbiAgICBULFxuICAgIFNlY3VyaXR5UG9saWN5VmlvbGF0aW9uRXZlbnRcbiAgPlxuICBvblNlZWtlZDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblNlZWtpbmc6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25TZWxlY3Q6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25TZWxlY3Rpb25DaGFuZ2U6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25TZWxlY3RTdGFydDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblN0YWxsZWQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25TdWJtaXQ6IEV2ZW50SGFuZGxlcjxULCBFdmVudD5cbiAgb25TdXNwZW5kOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uVGltZVVwZGF0ZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblRvZ2dsZTogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvblRvdWNoQ2FuY2VsOiBFdmVudEhhbmRsZXI8VCwgVG91Y2hFdmVudD5cbiAgb25Ub3VjaEVuZDogRXZlbnRIYW5kbGVyPFQsIFRvdWNoRXZlbnQ+XG4gIG9uVG91Y2hNb3ZlOiBFdmVudEhhbmRsZXI8VCwgVG91Y2hFdmVudD5cbiAgb25Ub3VjaFN0YXJ0OiBFdmVudEhhbmRsZXI8VCwgVG91Y2hFdmVudD5cbiAgb25UcmFuc2l0aW9uQ2FuY2VsOiBFdmVudEhhbmRsZXI8VCwgVHJhbnNpdGlvbkV2ZW50PlxuICBvblRyYW5zaXRpb25FbmQ6IEV2ZW50SGFuZGxlcjxULCBUcmFuc2l0aW9uRXZlbnQ+XG4gIG9uVHJhbnNpdGlvblJ1bjogRXZlbnRIYW5kbGVyPFQsIFRyYW5zaXRpb25FdmVudD5cbiAgb25UcmFuc2l0aW9uU3RhcnQ6IEV2ZW50SGFuZGxlcjxULCBUcmFuc2l0aW9uRXZlbnQ+XG4gIG9uVm9sdW1lQ2hhbmdlOiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uV2FpdGluZzogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbldlYmtpdEFuaW1hdGlvbkVuZDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbldlYmtpdEFuaW1hdGlvbkl0ZXJhdGlvbjogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbldlYmtpdEFuaW1hdGlvblN0YXJ0OiBFdmVudEhhbmRsZXI8VCwgRXZlbnQ+XG4gIG9uV2Via2l0VHJhbnNpdGlvbkVuZDogRXZlbnRIYW5kbGVyPFQsIEV2ZW50PlxuICBvbldoZWVsOiBFdmVudEhhbmRsZXI8VCwgV2hlZWxFdmVudD5cbn1cbiIsImltcG9ydCB7IGVmZmVjdCwgc2NvcGVkLCBzaWduYWwgfSBmcm9tIFwiLi4vZGVwcy50c1wiO1xuXG5jb25zdCBnbG9iYWxTb3VyY2VzID0gYXdhaXQgZ2V0R2xvYmFsU291cmNlcygpO1xuZXhwb3J0IGNvbnN0IGxvY2FsU291cmNlcyA9IHNpZ25hbDxTb3VyY2VbXT4oZ2V0TG9jYWxTb3VyY2VzKCkpO1xuXG5jb25zdCBzb3VyY2VzID0gc2NvcGVkKCgpID0+IHtcbiAgY29uc3Qgc291cmNlcyA9ICgpID0+IFsuLi5nbG9iYWxTb3VyY2VzLCAuLi5sb2NhbFNvdXJjZXMoKV07XG4gIGVmZmVjdCgoaW5pdCkgPT4ge1xuICAgIGNvbnN0IHNvdXJjZXMgPSBsb2NhbFNvdXJjZXMoKTtcbiAgICBpZiAoaW5pdCA9PT0gdHJ1ZSkgcmV0dXJuIGZhbHNlO1xuICAgIGxvY2FsU3RvcmFnZS5zZXRJdGVtKFwic291cmNlc1wiLCBKU09OLnN0cmluZ2lmeShzb3VyY2VzKSk7XG4gIH0sIHRydWUpO1xuICByZXR1cm4gc291cmNlcztcbn0pITtcblxuZXhwb3J0IHR5cGUgU291cmNlID0ge1xuICBuYW1lOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xufTtcblxuZnVuY3Rpb24gZ2V0TG9jYWxTb3VyY2VzKCk6IFNvdXJjZVtdIHtcbiAgY29uc3QgaW5pdFNvdXJjZXMgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShcInNvdXJjZXNcIikgfHwgXCJbXVwiO1xuICB0cnkge1xuICAgIHJldHVybiBKU09OLnBhcnNlKGluaXRTb3VyY2VzKTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIFtdO1xuICB9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldEdsb2JhbFNvdXJjZXMoKTogUHJvbWlzZTxTb3VyY2VbXT4ge1xuICB0cnkge1xuICAgIHJldHVybiBhd2FpdCAoYXdhaXQgZmV0Y2goXCIuL3NvdXJjZXMuanNvblwiKSkuanNvbigpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gW107XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFNvdXJjZXMoKTogU291cmNlW10ge1xuICByZXR1cm4gc291cmNlcygpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmluZCh1cmw6IHN0cmluZyk6IFNvdXJjZSB8IHVuZGVmaW5lZCB7XG4gIHJldHVybiBzb3VyY2VzKCkuZmluZCgoc291cmNlKSA9PiBzb3VyY2UudXJsID09PSB1cmwpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZmlyc3QoKTogU291cmNlIHwgdW5kZWZpbmVkIHtcbiAgcmV0dXJuIHNvdXJjZXMoKVswXTtcbn1cblxudHlwZSBDb25maWcgPSB7XG4gIHVybDogc3RyaW5nO1xuICBsaW1pdD86IG51bWJlcjtcbiAgcGFnZT86IG51bWJlcjtcbiAgdGFncz86IHN0cmluZ1tdO1xufTtcblxuZXhwb3J0IHR5cGUgQm9vcnUgPSB7XG4gIGlkOiBudW1iZXI7XG4gIHRhZ3M6IHN0cmluZ1tdO1xuICBmaWxlVXJsOiBzdHJpbmc7XG4gIHByZXZpZXdVcmw6IHN0cmluZztcbn07XG5cbnR5cGUgQm9vcnVSZXNwb25zZSA9IEJvb3J1UG9zdFtdIHwgeyBwb3N0OiBCb29ydVBvc3RbXSB9O1xuXG5leHBvcnQgdHlwZSBCb29ydVBvc3QgPSB7XG4gIGlkOiBudW1iZXI7XG4gIGZpbGVfdXJsOiBzdHJpbmc7XG4gIC8qKiBkYW5ib29ydS5kb25tYWkudXMgb25seSAqL1xuICB0YWdfc3RyaW5nOiBzdHJpbmc7XG4gIC8qKiB5YW5kZS5yZSAqL1xuICB0YWdzOiBzdHJpbmc7XG4gIC8qKiB5YW5kZS5yZSAqL1xuICBwcmV2aWV3X3VybDogc3RyaW5nO1xuICAvKiogZGFuYm9vcnUuZG9ubWFpLnVzICovXG4gIHByZXZpZXdfZmlsZV91cmw6IHN0cmluZztcbn07XG5cbmV4cG9ydCBmdW5jdGlvbiB1c2VCb29ydShjb25maWc6ICgpID0+IENvbmZpZykge1xuICBjb25zdCBwb3N0cyA9IHNpZ25hbDxCb29ydVtdPihbXSk7XG4gIGVmZmVjdChhc3luYyAoKSA9PiB7XG4gICAgY29uc3QgeyBwYWdlID0gMSwgbGltaXQgPSA0MCwgdXJsLCB0YWdzIH0gPSBjb25maWcoKTtcbiAgICBjb25zdCBpdGVtczogQm9vcnVbXSA9IFtdO1xuICAgIGNvbnN0IHNvdXJjZSA9IGZpbmQodXJsKT8udXJsIHx8IHVybDtcbiAgICBpZiAoc291cmNlKSB7XG4gICAgICBjb25zdCBhcGkgPSBuZXcgVVJMKHNvdXJjZSk7XG4gICAgICBjb25zdCBwYXJhbXMgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKCk7XG4gICAgICBwYXJhbXMuc2V0KFwicGFnZVwiLCBwYWdlLnRvU3RyaW5nKCkpO1xuICAgICAgcGFyYW1zLnNldChcImxpbWl0XCIsIGxpbWl0LnRvU3RyaW5nKCkpO1xuICAgICAgaWYgKHRhZ3M/Lmxlbmd0aCkgcGFyYW1zLnNldChcInRhZ3NcIiwgdGFncy5qb2luKFwiIFwiKSk7XG4gICAgICBhcGkuc2VhcmNoID0gcGFyYW1zLnRvU3RyaW5nKCk7XG4gICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKGFwaSk7XG4gICAgICBpZiAocmVzcG9uc2Uub2spIHtcbiAgICAgICAgY29uc3QganNvbjogQm9vcnVSZXNwb25zZSA9IGF3YWl0IHJlc3BvbnNlLmpzb24oKTtcbiAgICAgICAgZm9yIChjb25zdCBwb3N0IG9mIChBcnJheS5pc0FycmF5KGpzb24pID8ganNvbiA6IGpzb24ucG9zdCkgfHwgW10pIHtcbiAgICAgICAgICBpZiAocG9zdC5pZCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICB9XG4gICAgICAgICAgaWYgKHBvc3QuZmlsZV91cmwgPT09IHVuZGVmaW5lZCkge1xuICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgfVxuICAgICAgICAgIGlmIChcbiAgICAgICAgICAgIHBvc3QucHJldmlld191cmwgPT09IHVuZGVmaW5lZCAmJlxuICAgICAgICAgICAgcG9zdC5wcmV2aWV3X2ZpbGVfdXJsID09PSB1bmRlZmluZWRcbiAgICAgICAgICApIHtcbiAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgIH1cbiAgICAgICAgICBpdGVtcy5wdXNoKG5vcm1hbGl6ZVBvc3QocG9zdCkpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHBvc3RzKGl0ZW1zKTtcbiAgfSk7XG4gIHJldHVybiBwb3N0cztcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplUG9zdChwb3N0OiBCb29ydVBvc3QpOiBCb29ydSB7XG4gIGNvbnN0IGl0ZW06IEJvb3J1ID0ge1xuICAgIGlkOiBwb3N0LmlkLFxuICAgIGZpbGVVcmw6IHBvc3QuZmlsZV91cmwsXG4gICAgcHJldmlld1VybDogcG9zdC5wcmV2aWV3X3VybCB8fCBwb3N0LnByZXZpZXdfZmlsZV91cmwsXG4gICAgdGFnczogW10sXG4gIH07XG5cbiAgaWYgKChwb3N0LnRhZ3MgfHwgcG9zdC50YWdfc3RyaW5nKSkge1xuICAgIGl0ZW0udGFncyA9IChwb3N0LnRhZ3MgfHwgcG9zdC50YWdfc3RyaW5nKVxuICAgICAgLnNwbGl0KFwiIFwiKVxuICAgICAgLmZpbHRlcigodmFsdWUpID0+IHZhbHVlKTtcbiAgfVxuXG4gIHJldHVybiBpdGVtO1xufVxuIiwiaW1wb3J0IHsgZWZmZWN0LCBvbkRlc3Ryb3kgfSBmcm9tIFwiLi4vZGVwcy50c1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlVGl0bGUodGl0bGU6ICgpID0+IHN0cmluZykge1xuICBjb25zdCBwcmV2aW91c1RpdGxlID0gZG9jdW1lbnQudGl0bGU7XG4gIGVmZmVjdCgoKSA9PiBkb2N1bWVudC50aXRsZSA9IHRpdGxlKCkpO1xuICBvbkRlc3Ryb3koKCkgPT4gZG9jdW1lbnQudGl0bGUgPSBwcmV2aW91c1RpdGxlKTtcbn1cbiIsImltcG9ydCB7IGNvbXB1dGVkLCBlZmZlY3QsIG9uLCBzY29wZWQsIHNpZ25hbCB9IGZyb20gXCIuL2RlcHMudHNcIjtcbmltcG9ydCB7IEJvb3J1LCBmaXJzdCwgdXNlQm9vcnUgfSBmcm9tIFwiLi9jb21wb25lbnRzL3VzZS1ib29ydS50c1wiO1xuaW1wb3J0IHsgdXNlVGl0bGUgfSBmcm9tIFwiLi9jb21wb25lbnRzL3VzZS10aXRsZS50c1wiO1xuXG5jb25zdCBnZXRIYXNoID0gKCkgPT4ge1xuICBsZXQgaGFzaCA9IGxvY2F0aW9uLmhhc2g7XG4gIGlmIChoYXNoLnN0YXJ0c1dpdGgoXCIjXCIpKSBoYXNoID0gaGFzaC5zbGljZSgxKTtcbiAgcmV0dXJuIGhhc2g7XG59O1xuXG5jb25zdCBnZXRQYXJhbXMgPSAoKSA9PiB7XG4gIGNvbnN0IHBhcmFtcyA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoZ2V0SGFzaCgpKTtcbiAgcmV0dXJuIHtcbiAgICB1cmw6IHBhcmFtcy5oYXMoXCJ1cmxcIikgPyBwYXJhbXMuZ2V0KFwidXJsXCIpISA6IGZpcnN0KCk/LnVybCEsXG4gICAgcGFnZTogcGFyYW1zLmhhcyhcInBhZ2VcIikgPyB+fnBhcmFtcy5nZXQoXCJwYWdlXCIpISA6IDEsXG4gICAgbGltaXQ6IHBhcmFtcy5oYXMoXCJsaW1pdFwiKSA/IH5+cGFyYW1zLmdldChcImxpbWl0XCIpISA6IDQwLFxuICAgIHNlYXJjaDogcGFyYW1zLmhhcyhcInNlYXJjaFwiKSA/IHBhcmFtcy5nZXQoXCJzZWFyY2hcIikhIDogXCJcIixcbiAgICB0YWdzOiBwYXJhbXMuaGFzKFwidGFnc1wiKVxuICAgICAgPyBwYXJhbXMuZ2V0KFwidGFnc1wiKSEuc3BsaXQoXCIsXCIpLmZpbHRlcigodGFnKSA9PiB0YWcpXG4gICAgICA6IFtdLFxuICB9O1xufTtcblxuZXhwb3J0IGRlZmF1bHQgc2NvcGVkKCgpID0+IHtcbiAgY29uc3QgaW5pdCA9IGdldFBhcmFtcygpO1xuICBjb25zdCB1cmwgPSBzaWduYWw8c3RyaW5nPihpbml0LnVybCk7XG4gIGNvbnN0IGxpbWl0ID0gc2lnbmFsPG51bWJlcj4oaW5pdC5saW1pdCk7XG4gIGNvbnN0IGxvYWRlZCA9IHNpZ25hbCgwKTtcbiAgY29uc3Qgc2l6ZSA9IHNpZ25hbChJbmZpbml0eSk7XG4gIGNvbnN0IHNlYXJjaCA9IHNpZ25hbDxzdHJpbmc+KGluaXQuc2VhcmNoKTtcbiAgY29uc3QgaGlnaGxpZ2h0ZWQgPSBzaWduYWw8c3RyaW5nW10+KFtdKTtcbiAgY29uc3QgdGFncyA9IHNpZ25hbDxzdHJpbmdbXT4oaW5pdC50YWdzKTtcbiAgY29uc3QgcGFnZSA9IHNpZ25hbChpbml0LnBhZ2UpO1xuICBjb25zdCBzZWxlY3QgPSBzaWduYWw8Qm9vcnU+KCk7XG4gIGNvbnN0IHBvc3RzID0gdXNlQm9vcnUoKCkgPT4ge1xuICAgIHJldHVybiB7XG4gICAgICB1cmw6IHVybCgpLFxuICAgICAgbGltaXQ6IGxpbWl0KCksXG4gICAgICBwYWdlOiBwYWdlKCksXG4gICAgICB0YWdzOiB0YWdzKCksXG4gICAgfTtcbiAgfSk7XG4gIGNvbnN0IHBvc3RUYWdzID0gKCkgPT4ge1xuICAgIGNvbnN0IHRhZ3M6IHN0cmluZ1tdID0gW107XG4gICAgZm9yIChjb25zdCBwb3N0IG9mIHBvc3RzKCkpIHtcbiAgICAgIGZvciAoY29uc3QgdGFnIG9mIHBvc3QudGFncykge1xuICAgICAgICBpZiAodGFncy5pbmNsdWRlcyh0YWcpID09PSBmYWxzZSkgdGFncy5wdXNoKHRhZyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0YWdzLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGlmIChhIDwgYikgcmV0dXJuIC0xO1xuICAgICAgaWYgKGEgPiBiKSByZXR1cm4gMTtcbiAgICAgIHJldHVybiAwO1xuICAgIH0pO1xuICB9O1xuICBjb25zdCBhZGRUYWcgPSAodGFnOiBzdHJpbmcpID0+ICFoYXNUYWcodGFnKSAmJiB0YWdzKFsuLi50YWdzKCksIHRhZ10pO1xuICBjb25zdCBkZWxUYWcgPSAodGFnOiBzdHJpbmcpID0+IHRhZ3ModGFncygpLmZpbHRlcigoJCkgPT4gJCAhPT0gdGFnKSk7XG4gIGNvbnN0IHRvZ2dsZVRhZyA9ICh0YWc6IHN0cmluZykgPT4gaGFzVGFnKHRhZykgPyBkZWxUYWcodGFnKSA6IGFkZFRhZyh0YWcpO1xuICBjb25zdCBoYXNUYWcgPSAodGFnOiBzdHJpbmcpID0+IHRhZ3MoKS5pbmNsdWRlcyh0YWcpO1xuICBjb25zdCBwYWdlUmVzZXRUcmlnZ2VyID0gKCkgPT4gKHVybCgpLCB0YWdzKCksIHVuZGVmaW5lZCk7XG4gIGNvbnN0IG9uUG9wU3RhdGUgPSAoKSA9PiB7XG4gICAgY29uc3QgcGFyYW1zID0gZ2V0UGFyYW1zKCk7XG4gICAgdXJsKHBhcmFtcy51cmwpO1xuICAgIHBhZ2UocGFyYW1zLnBhZ2UpO1xuICAgIGxpbWl0KHBhcmFtcy5saW1pdCk7XG4gICAgc2VhcmNoKHBhcmFtcy5zZWFyY2gpO1xuICAgIHRhZ3MocGFyYW1zLnRhZ3MpO1xuICB9O1xuXG4gIGVmZmVjdChcbiAgICBvbihzZWFyY2gsIChjdXJyZW50OiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcbiAgICAgIGlmIChjdXJyZW50ICE9PSBzZWFyY2goKSkge1xuICAgICAgICBjb25zdCB0YWdzID0gc2VhcmNoKCkuc3BsaXQoXCIgXCIpLmZpbHRlcigodmFsdWUpID0+IHZhbHVlKTtcbiAgICAgICAgZm9yIChjb25zdCB0YWcgb2YgdGFncykgYWRkVGFnKHRhZyk7XG4gICAgICAgIHBhZ2UoMSk7XG4gICAgICB9XG4gICAgICByZXR1cm4gc2VhcmNoKCk7XG4gICAgfSksXG4gICAgaW5pdC5zZWFyY2gsXG4gICk7XG5cbiAgdXNlVGl0bGUoKCkgPT4ge1xuICAgIGxldCB0aXRsZSA9IGDjg5bjg6njgqbjgrbvvJoke3BhZ2UoKX1gO1xuICAgIGlmICh0YWdzKCkubGVuZ3RoKSB7XG4gICAgICB0aXRsZSArPSBgIOOAjCR7dGFncygpLmpvaW4oXCLjgIEgXCIpfeOAjWA7XG4gICAgfVxuICAgIHJldHVybiB0aXRsZTtcbiAgfSk7XG5cbiAgZWZmZWN0KG9uKHBvc3RzLCAoKSA9PiB7XG4gICAgc2l6ZShwb3N0cygpLmxlbmd0aCk7XG4gICAgbG9hZGVkKDApO1xuICB9KSk7XG5cbiAgZWZmZWN0PHN0cmluZywgc3RyaW5nPihcbiAgICBvbihwYWdlUmVzZXRUcmlnZ2VyLCAoY3VycmVudCkgPT4ge1xuICAgICAgY29uc3QgbmV4dCA9IGAke3VybCgpfSR7dGFncygpLmpvaW4oKX1gO1xuICAgICAgaWYgKGN1cnJlbnQgIT09IG5leHQpIHBhZ2UoMSk7XG4gICAgICByZXR1cm4gbmV4dDtcbiAgICB9KSxcbiAgICBgJHt1cmwoKX0ke3RhZ3MoKS5qb2luKCl9YCxcbiAgKTtcblxuICBlZmZlY3Q8VVJMU2VhcmNoUGFyYW1zLCBVUkxTZWFyY2hQYXJhbXM+KChwYXJhbXMpID0+IHtcbiAgICBwYXJhbXMuc2V0KFwicGFnZVwiLCBwYWdlKCkudG9TdHJpbmcoKSk7XG4gICAgcGFyYW1zLnNldChcImxpbWl0XCIsIGxpbWl0KCkudG9TdHJpbmcoKSk7XG4gICAgcGFyYW1zLnNldChcInVybFwiLCB1cmwoKSk7XG4gICAgaWYgKHNlYXJjaCgpLmxlbmd0aCkgcGFyYW1zLnNldChcInNlYXJjaFwiLCBzZWFyY2goKSk7XG4gICAgZWxzZSBwYXJhbXMuZGVsZXRlKFwic2VhcmNoXCIpO1xuICAgIGlmICh0YWdzKCkubGVuZ3RoKSBwYXJhbXMuc2V0KFwidGFnc1wiLCB0YWdzKCkuam9pbihcIixcIikpO1xuICAgIGVsc2UgcGFyYW1zLmRlbGV0ZShcInRhZ3NcIik7XG4gICAgcmVtb3ZlRXZlbnRMaXN0ZW5lcihcInBvcHN0YXRlXCIsIG9uUG9wU3RhdGUpO1xuICAgIGxvY2F0aW9uLmhhc2ggPSBwYXJhbXMudG9TdHJpbmcoKTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwicG9wc3RhdGVcIiwgb25Qb3BTdGF0ZSk7XG4gICAgcmV0dXJuIHBhcmFtcztcbiAgfSwgbmV3IFVSTFNlYXJjaFBhcmFtcyhnZXRIYXNoKCkpKTtcblxuICByZXR1cm4ge1xuICAgIGhpZ2hsaWdodGVkLFxuICAgIHRhZ3MsXG4gICAgcG9zdHMsXG4gICAgcG9zdFRhZ3MsXG4gICAgcGFnZSxcbiAgICBzZWxlY3QsXG4gICAgYWRkVGFnLFxuICAgIGRlbFRhZyxcbiAgICBoYXNUYWcsXG4gICAgdG9nZ2xlVGFnLFxuICAgIHNlYXJjaCxcbiAgICBsb2FkZWQsXG4gICAgc2l6ZSxcbiAgICBsaW1pdCxcbiAgICB1cmwsXG4gIH07XG59KSE7XG4iLCJpbXBvcnQgeyBlZmZlY3QsIG9uQ2xlYW51cCwgU2lnbmFsLCBzaWduYWwgfSBmcm9tIFwiLi4vZGVwcy50c1wiO1xuXG5leHBvcnQgZnVuY3Rpb24gdXNlUGVydmVydCgpOiBTaWduYWw8Ym9vbGVhbj4ge1xuICBjb25zdCBpbml0ID0gbG9jYWxTdG9yYWdlLmdldEl0ZW0oXCJpczpwZXJ2ZXJ0XCIpID09PSBcInRydWVcIjtcbiAgY29uc3QgY29kZXMgPSBcImltYXBlcnZlcnRcIi5zcGxpdChcIlwiKTtcbiAgY29uc3QgcGVydmVydCA9IHNpZ25hbChpbml0KTtcbiAgbGV0IGluZGV4ID0gMDtcbiAgY29uc3Qgb25LZXlVcCA9ICh7IGtleSB9OiBLZXlib2FyZEV2ZW50KSA9PiB7XG4gICAgaWYgKGluZGV4ID09PSBjb2Rlcy5sZW5ndGggLSAxKSB7XG4gICAgICBsb2NhbFN0b3JhZ2Uuc2V0SXRlbShcImlzOnBlcnZlcnRcIiwgXCJ0cnVlXCIpO1xuICAgICAgcGVydmVydCh0cnVlKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKFxuICAgICAga2V5ICE9IG51bGwgJiZcbiAgICAgIGNvZGVzW2luZGV4XSAhPSBudWxsICYmXG4gICAgICBrZXkudG9Mb3dlckNhc2UoKSA9PT0gY29kZXNbaW5kZXhdLnRvTG93ZXJDYXNlKClcbiAgICApIHtcbiAgICAgIGluZGV4Kys7XG4gICAgfSBlbHNlIHtcbiAgICAgIGluZGV4ID0gMDtcbiAgICAgIHBlcnZlcnQoZmFsc2UpO1xuICAgIH1cbiAgfTtcbiAgZWZmZWN0KCgpID0+IHtcbiAgICBvbkNsZWFudXAoKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIG9uS2V5VXApKTtcbiAgICBpZiAocGVydmVydCgpKSByZXR1cm47XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIG9uS2V5VXApO1xuICB9KTtcbiAgcmV0dXJuIHBlcnZlcnQ7XG59XG4iLCJpbnRlcmZhY2UgUmVhZEFzTWFwIHtcbiAgcmVhZEFzQXJyYXlCdWZmZXI6IEFycmF5QnVmZmVyO1xuICByZWFkQXNCaW5hcnlTdHJpbmc6IHN0cmluZztcbiAgcmVhZEFzRGF0YVVSTDogc3RyaW5nO1xuICByZWFkQXNUZXh0OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1cGxvYWRGaWxlPFQgZXh0ZW5kcyBrZXlvZiBSZWFkQXNNYXA+KFxuICBhY2NlcHQ6IHN0cmluZyxcbiAgcmVhZEFzOiBULFxuKTogUHJvbWlzZTxSZWFkQXNNYXBbVF0+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXMpID0+IHtcbiAgICBjb25zdCBpbnB1dCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJpbnB1dFwiKTtcbiAgICBpbnB1dC50eXBlID0gXCJmaWxlXCI7XG4gICAgaW5wdXQuYWNjZXB0ID0gYWNjZXB0O1xuICAgIGlucHV0Lm9uY2hhbmdlID0gKGV2KSA9PiB7XG4gICAgICBjb25zdCBmaWxlcyA9ICg8YW55PiBldi5jdXJyZW50VGFyZ2V0KS5maWxlcztcbiAgICAgIGlmIChmaWxlcyA9PT0gbnVsbCkgcmV0dXJuO1xuICAgICAgY29uc3QgcmVhZGVyID0gbmV3IEZpbGVSZWFkZXIoKTtcbiAgICAgIHJlYWRlci5vbmxvYWQgPSAoKSA9PiB7XG4gICAgICAgIHJlcyg8UmVhZEFzTWFwW1RdPiByZWFkZXIucmVzdWx0KTtcbiAgICAgIH07XG4gICAgICByZWFkZXJbcmVhZEFzXShmaWxlc1swXSk7XG4gICAgfTtcbiAgICBpbnB1dC5jbGljaygpO1xuICB9KTtcbn1cbiIsImV4cG9ydCBmdW5jdGlvbiBkb3dubG9hZChuYW1lOiBzdHJpbmcsIHR5cGU6IHN0cmluZywgZGF0YTogc3RyaW5nKTogdm9pZCB7XG4gIGNvbnN0IGVuY29kZWQgPSBgJHt0eXBlfTtjaGFyc2V0PXV0Zi04LCR7ZW5jb2RlVVJJQ29tcG9uZW50KGRhdGEpfWA7XG4gIGNvbnN0IGEgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiYVwiKTtcbiAgYS5ocmVmID0gXCJkYXRhOlwiICsgZW5jb2RlZDtcbiAgYS5kb3dubG9hZCA9IG5hbWU7XG4gIGEuY2xpY2soKTtcbn1cbiIsImltcG9ydCB7IGFkZEVsZW1lbnQsIGNvbXBvbmVudCwgZWZmZWN0LCBzaWduYWwsIHZpZXcgfSBmcm9tIFwiLi4vZGVwcy50c1wiO1xuXG50eXBlIFdpbmRvd1Byb3BzID0ge1xuICB0aXRsZTogKCkgPT4gc3RyaW5nO1xuICBzaG93OiAoKSA9PiBib29sZWFuO1xuICB0aXRsZUNoaWxkcmVuPzogKCkgPT4gdm9pZDtcbiAgY2hpbGRyZW46ICgpID0+IHZvaWQ7XG4gIHdpZHRoPzogc3RyaW5nO1xuICBoZWlnaHQ/OiBzdHJpbmc7XG4gIG9uT3Blbj86ICgpID0+IHZvaWQ7XG4gIG9uQ2xvc2U/OiAoKSA9PiB2b2lkO1xufTtcblxuZnVuY3Rpb24gV2luZG93KHByb3BzOiBXaW5kb3dQcm9wcyk6IFdpbmRvd1Byb3BzIHtcbiAgY29uc3Qgc2hvdyA9IHNpZ25hbChmYWxzZSk7XG4gIGNvbnN0IGZ1bGxzY3JlZW4gPSBzaWduYWwoZmFsc2UpO1xuICBlZmZlY3QoKCkgPT4gc2hvdyhwcm9wcy5zaG93KCkpKTtcbiAgZWZmZWN0KCgpID0+IHtcbiAgICBpZiAoc2hvdygpKSBwcm9wcy5vbk9wZW4/LigpO1xuICAgIGVsc2UgcHJvcHMub25DbG9zZT8uKCk7XG4gIH0pO1xuXG4gIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICBhdHRyLnNob3cgPSBzaG93O1xuICAgIGF0dHIuY2xhc3MgPSBcIndpbmRvd1wiO1xuICAgIGF0dHIuZnVsbHNjcmVlbiA9IGZ1bGxzY3JlZW47XG4gICAgYXR0ci5zdHlsZSA9IHsgd2lkdGg6IHByb3BzLndpZHRoLCBoZWlnaHQ6IHByb3BzLmhlaWdodCB9O1xuXG4gICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwid2luZG93LXRpdGxlXCI7XG4gICAgICBhZGRFbGVtZW50KFwiaDNcIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci50ZXh0Q29udGVudCA9IHByb3BzLnRpdGxlO1xuICAgICAgICBhdHRyLnRpdGxlID0gcHJvcHMudGl0bGU7XG4gICAgICB9KTtcblxuICAgICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJ3aW5kb3ctdGl0bGUtY2hpbGRyZW5cIjtcbiAgICAgICAgaWYgKHByb3BzLnRpdGxlQ2hpbGRyZW4pIHtcbiAgICAgICAgICB2aWV3KHByb3BzLnRpdGxlQ2hpbGRyZW4pO1xuICAgICAgICB9XG4gICAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgICBhdHRyLmNsYXNzID0gKCkgPT4gYGljb24gJHtmdWxsc2NyZWVuKCkgPyBcImNvbXByZXNzXCIgOiBcImVubGFyZ2VcIn1gO1xuICAgICAgICAgIGF0dHIudGl0bGUgPSAoKSA9PiBgJHtmdWxsc2NyZWVuKCkgPyBcImNvbXByZXNzXCIgOiBcImVubGFyZ2VcIn0gd2luZG93YDtcbiAgICAgICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiBmdWxsc2NyZWVuKCFmdWxsc2NyZWVuKCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gY2xvc2VcIjtcbiAgICAgICAgICBhdHRyLnRpdGxlID0gXCJjbG9zZSB3aW5kb3dcIjtcbiAgICAgICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiBzaG93KGZhbHNlKTtcbiAgICAgICAgfSk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICAgIGF0dHIuY2xhc3MgPSBcIndpbmRvdy1jb250ZW50XCI7XG4gICAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICAgIGF0dHIuY2xhc3MgPSBcIndpbmRvdy1jb250ZW50LXdyYXBwZXJcIjtcbiAgICAgICAgdmlldyhwcm9wcy5jaGlsZHJlbik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgcmV0dXJuIHByb3BzO1xufVxuXG5leHBvcnQgZGVmYXVsdCBjb21wb25lbnQoV2luZG93KTtcbiIsImltcG9ydCB7IGFkZEVsZW1lbnQsIGNvbXBvbmVudCwgU2lnbmFsLCBzaWduYWwgfSBmcm9tIFwiLi4vZGVwcy50c1wiO1xuaW1wb3J0IHsgbG9jYWxTb3VyY2VzLCBTb3VyY2UgfSBmcm9tIFwiLi91c2UtYm9vcnUudHNcIjtcbmltcG9ydCB7IHVwbG9hZEZpbGUgfSBmcm9tIFwiLi91cGxvYWQudHNcIjtcbmltcG9ydCB7IGRvd25sb2FkIH0gZnJvbSBcIi4vZG93bmxvYWQudHNcIjtcbmltcG9ydCBXaW5kb3cgZnJvbSBcIi4vd2luZG93LnRzXCI7XG5cbmV4cG9ydCBjb25zdCBTb3VyY2VFZGl0b3IgPSBjb21wb25lbnQoKHNvdXJjZUVkaXQ6IFNpZ25hbDxib29sZWFuPikgPT4ge1xuICBXaW5kb3coe1xuICAgIHRpdGxlOiAoKSA9PiBcInNvdXJjZSBlZGl0b3JcIixcbiAgICBzaG93OiBzb3VyY2VFZGl0LFxuICAgIHRpdGxlQ2hpbGRyZW4oKSB7XG4gICAgICBhZGRFbGVtZW50KFwiYnV0dG9uXCIsIChhdHRyKSA9PiB7XG4gICAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gZG93bmxvYWQtanNvblwiO1xuICAgICAgICBhdHRyLnRpdGxlID0gXCJkb3dubG9hZCBzb3VyY2VzXCI7XG4gICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHtcbiAgICAgICAgICBkb3dubG9hZChcbiAgICAgICAgICAgIGBzb3VyY2VzLSR7RGF0ZS5ub3coKX0uanNvbmAsXG4gICAgICAgICAgICBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgIEpTT04uc3RyaW5naWZ5KGxvY2FsU291cmNlcygpLCBudWxsLCAyKSxcbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBjaGlsZHJlbigpIHtcbiAgICAgIGZvciAoY29uc3Qgc291cmNlIG9mIGxvY2FsU291cmNlcygpKSB7XG4gICAgICAgIFNvdXJjZUVkaXQoc291cmNlKTtcbiAgICAgIH1cbiAgICAgIEFkZFNvdXJjZSgpO1xuICAgIH0sXG4gIH0pO1xufSk7XG5cbmNvbnN0IEFkZFNvdXJjZSA9IGNvbXBvbmVudCgoKSA9PiB7XG4gIGNvbnN0IG5hbWUgPSBzaWduYWwoXCJcIik7XG4gIGNvbnN0IHVybCA9IHNpZ25hbChcIlwiKTtcblxuICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgYXR0ci5jbGFzcyA9IFwiZmxleCBqdXN0aWZ5LWNvbnRlbnQtc3BhY2UtYmV0d2VlIGZsZXgtZ2FwLTEwXCI7XG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGFsaWduLWl0ZW1zLWJhc2VsaW5lIHdpZHRoLTEwMFwiO1xuICAgICAgYWRkRWxlbWVudChcImxhYmVsXCIsIChhdHRyKSA9PiBhdHRyLnRleHRDb250ZW50ID0gXCJuYW1lOlwiKTtcbiAgICAgIGFkZEVsZW1lbnQoXCJpbnB1dFwiLCAoYXR0cikgPT4ge1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJmbGV4LTFcIjtcbiAgICAgICAgYXR0ci5uYW1lID0gXCJuYW1lXCI7XG4gICAgICAgIGF0dHIudmFsdWUgPSBuYW1lO1xuICAgICAgICBhdHRyLm9uSW5wdXQgPSAoZXYpID0+IG5hbWUoZXYuY3VycmVudFRhcmdldC52YWx1ZSk7XG4gICAgICAgIGF0dHIucGxhY2Vob2xkZXIgPSBcIipCb29ydVwiO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGFsaWduLWl0ZW1zLWJhc2VsaW5lIHdpZHRoLTEwMFwiO1xuICAgICAgYWRkRWxlbWVudChcImxhYmVsXCIsIChhdHRyKSA9PiBhdHRyLnRleHRDb250ZW50ID0gXCJ1cmw6XCIpO1xuICAgICAgYWRkRWxlbWVudChcImlucHV0XCIsIChhdHRyKSA9PiB7XG4gICAgICAgIGF0dHIuY2xhc3MgPSBcImZsZXgtMVwiO1xuICAgICAgICBhdHRyLm5hbWUgPSBcInVybFwiO1xuICAgICAgICBhdHRyLnZhbHVlID0gdXJsO1xuICAgICAgICBhdHRyLm9uSW5wdXQgPSAoZXYpID0+IHVybChldi5jdXJyZW50VGFyZ2V0LnZhbHVlKTtcbiAgICAgICAgYXR0ci5wbGFjZWhvbGRlciA9IFwiaHR0cHM6Ly8uLi5cIjtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwiZmxleFwiO1xuICAgICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJpY29uIHBsdXNcIjtcbiAgICAgICAgYXR0ci50aXRsZSA9IFwiYWRkIHNvdXJjZVwiO1xuICAgICAgICBhdHRyLmRpc2FibGVkID0gKCkgPT4gIW5hbWUoKSB8fCAhdXJsKCk7XG4gICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHtcbiAgICAgICAgICBpZiAoIW5hbWUoKSB8fCAhdXJsKCkpIHJldHVybjtcbiAgICAgICAgICBsb2NhbFNvdXJjZXMoXG4gICAgICAgICAgICBsb2NhbFNvdXJjZXMoKS5jb25jYXQoe1xuICAgICAgICAgICAgICBuYW1lOiBuYW1lKCksXG4gICAgICAgICAgICAgIHVybDogdXJsKCksXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICApO1xuICAgICAgICAgIHVybChcIlwiKTtcbiAgICAgICAgICBuYW1lKFwiXCIpO1xuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci5jbGFzcyA9IFwiaWNvbiBpbXBvcnRcIjtcbiAgICAgICAgYXR0ci50aXRsZSA9IFwiaW1wb3J0IHNvdXJjZVwiO1xuICAgICAgICBhdHRyLm9uQ2xpY2sgPSBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgZGF0YSA9IGF3YWl0IHVwbG9hZEZpbGUoXCIuanNvblwiLCBcInJlYWRBc1RleHRcIik7XG4gICAgICAgICAgY29uc3QganNvbiA9IEpTT04ucGFyc2UoZGF0YSk7XG4gICAgICAgICAgY29uc3QgaW1wb3J0ZWRTb3VyY2VzOiBTb3VyY2VbXSA9IFtdO1xuICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KGpzb24pKSB7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHNvdXJjZSBvZiBqc29uKSB7XG4gICAgICAgICAgICAgIGlmIChzb3VyY2UubmFtZSAmJiBzb3VyY2UudXJsKSB7XG4gICAgICAgICAgICAgICAgaW1wb3J0ZWRTb3VyY2VzLnB1c2goc291cmNlKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBsb2NhbFNvdXJjZXMobG9jYWxTb3VyY2VzKCkuY29uY2F0KGltcG9ydGVkU291cmNlcykpO1xuICAgICAgICB9O1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH0pO1xufSk7XG5cbmNvbnN0IFNvdXJjZUVkaXQgPSBjb21wb25lbnQoKHNvdXJjZTogU291cmNlKSA9PiB7XG4gIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGp1c3RpZnktY29udGVudC1zcGFjZS1iZXR3ZWVuIGZsZXgtZ2FwLTEwXCI7XG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGFsaWduLWl0ZW1zLWJhc2VsaW5lIHdpZHRoLTEwMFwiO1xuICAgICAgYWRkRWxlbWVudChcImxhYmVsXCIsIChhdHRyKSA9PiBhdHRyLnRleHRDb250ZW50ID0gXCJuYW1lOlwiKTtcbiAgICAgIGFkZEVsZW1lbnQoXCJpbnB1dFwiLCAoYXR0cikgPT4ge1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJmbGV4LTFcIjtcbiAgICAgICAgYXR0ci5uYW1lID0gXCJuYW1lXCI7XG4gICAgICAgIGF0dHIudmFsdWUgPSBzb3VyY2UubmFtZTtcbiAgICAgICAgYXR0ci5wbGFjZWhvbGRlciA9IFwiKkJvb3J1XCI7XG4gICAgICAgIGF0dHIub25JbnB1dCA9IChldikgPT4gc291cmNlLm5hbWUgPSBldi5jdXJyZW50VGFyZ2V0LnZhbHVlO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJmbGV4IGFsaWduLWl0ZW1zLWJhc2VsaW5lIHdpZHRoLTEwMFwiO1xuICAgICAgYWRkRWxlbWVudChcImxhYmVsXCIsIChhdHRyKSA9PiBhdHRyLnRleHRDb250ZW50ID0gXCJ1cmw6XCIpO1xuICAgICAgYWRkRWxlbWVudChcImlucHV0XCIsIChhdHRyKSA9PiB7XG4gICAgICAgIGF0dHIuY2xhc3MgPSBcImZsZXgtMVwiO1xuICAgICAgICBhdHRyLnZhbHVlID0gc291cmNlLnVybDtcbiAgICAgICAgYXR0ci5wbGFjZWhvbGRlciA9IFwiaHR0cHM6Ly8uLi5cIjtcbiAgICAgICAgYXR0ci5vbklucHV0ID0gKGV2KSA9PiBzb3VyY2UudXJsID0gZXYuY3VycmVudFRhcmdldC52YWx1ZTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci5jbGFzcyA9IFwiZmxleFwiO1xuICAgICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJpY29uIGNoZWNrXCI7XG4gICAgICAgIGF0dHIudGl0bGUgPSBcInNhdmUgc291cmNlXCI7XG4gICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXdTb3VyY2UgPSB7IHVybDogc291cmNlLnVybCwgbmFtZTogc291cmNlLm5hbWUgfTtcbiAgICAgICAgICBsb2NhbFNvdXJjZXMoXG4gICAgICAgICAgICBsb2NhbFNvdXJjZXMoKVxuICAgICAgICAgICAgICAuZmlsdGVyKCgkKSA9PiAkICE9PSBzb3VyY2UpXG4gICAgICAgICAgICAgIC5jb25jYXQobmV3U291cmNlKSxcbiAgICAgICAgICApO1xuICAgICAgICB9O1xuICAgICAgfSk7XG5cbiAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci5jbGFzcyA9IFwiaWNvbiBkZWxldGVcIjtcbiAgICAgICAgYXR0ci50aXRsZSA9IFwiZGVsZXRlIHNvdXJjZVwiO1xuICAgICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiB7XG4gICAgICAgICAgbG9jYWxTb3VyY2VzKGxvY2FsU291cmNlcygpLmZpbHRlcigoJCkgPT4gJCAhPT0gc291cmNlKSk7XG4gICAgICAgIH07XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiIsImltcG9ydCB7IGVmZmVjdCwgb24sIHNpZ25hbCB9IGZyb20gXCIuLi9kZXBzLnRzXCI7XG5cbmNvbnN0IGNhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZVdpa2koaWQ6IHN0cmluZywgdHJpZ2dlcjogKCkgPT4gYm9vbGVhbikge1xuICBjb25zdCB3aWtpID0gc2lnbmFsPHN0cmluZz4oaWQpO1xuICBlZmZlY3Qob24odHJpZ2dlciwgKCkgPT4ge1xuICAgIGlmICh0cmlnZ2VyKCkgPT09IGZhbHNlKSByZXR1cm4gd2lraShpZCk7XG4gICAgaWYgKGNhY2hlLmhhcyhpZCkpIHJldHVybiB3aWtpKGNhY2hlLmdldChpZCkpO1xuICAgIGZldGNoKGBodHRwczovL2RhbmJvb3J1LmRvbm1haS51cy93aWtpX3BhZ2VzLyR7aWR9Lmpzb25gKVxuICAgICAgLnRoZW4oYXN5bmMgKHJlcykgPT4ge1xuICAgICAgICBjYWNoZS5zZXQoaWQsIHJlcy5vayA/IChhd2FpdCByZXMuanNvbigpKS5ib2R5IDogaWQpO1xuICAgICAgfSk7XG4gIH0pKTtcbiAgcmV0dXJuIHdpa2k7XG59XG4iLCJpbXBvcnQgeyBhZGRFbGVtZW50LCBjb21wb25lbnQsIHNpZ25hbCB9IGZyb20gXCIuLi9kZXBzLnRzXCI7XG5pbXBvcnQgQm9vcnUgZnJvbSBcIi4uL2NvbnRleHQudHNcIjtcbmltcG9ydCB7IHVzZVdpa2kgfSBmcm9tIFwiLi91c2Utd2lraS50c1wiO1xuXG5leHBvcnQgY29uc3QgVGFnID0gY29tcG9uZW50KChuYW1lOiBzdHJpbmcpID0+IHtcbiAgY29uc3QgeyB0b2dnbGVUYWcsIHRhZ3MsIGhpZ2hsaWdodGVkIH0gPSBCb29ydTtcbiAgY29uc3QgdHJpZ2dlciA9IHNpZ25hbDxib29sZWFuPihmYWxzZSk7XG4gIGNvbnN0IHdpa2kgPSB1c2VXaWtpKG5hbWUsIHRyaWdnZXIpO1xuICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgYXR0ci50ZXh0Q29udGVudCA9IG5hbWU7XG4gICAgYXR0ci5jbGFzcyA9IFwidGFnXCI7XG4gICAgYXR0ci50aXRsZSA9IHdpa2k7XG4gICAgYXR0ci5vbkNsaWNrID0gKCkgPT4gdG9nZ2xlVGFnKG5hbWUpO1xuICAgIGF0dHIub25Nb3VzZU92ZXIgPSAoKSA9PiB0cmlnZ2VyKHRydWUpO1xuICAgIGF0dHIub25Nb3VzZU91dCA9ICgpID0+IHRyaWdnZXIoZmFsc2UpO1xuICAgIGF0dHIuc3RhdGUgPSAoKSA9PiB7XG4gICAgICBpZiAodGFncygpLmluY2x1ZGVzKG5hbWUpKSByZXR1cm4gXCJhY3RpdmVcIjtcbiAgICAgIGVsc2UgaWYgKGhpZ2hsaWdodGVkKCkuaW5jbHVkZXMobmFtZSkpIHJldHVybiBcImhpZ2hsaWdodFwiO1xuICAgIH07XG4gIH0pO1xufSk7XG5cbmV4cG9ydCBkZWZhdWx0IFRhZztcbiIsImltcG9ydCBCb29ydSBmcm9tIFwiLi4vY29udGV4dC50c1wiO1xuaW1wb3J0IHtcbiAgYWRkRWxlbWVudCxcbiAgY29tcG9uZW50LFxuICBlbGVtZW50UmVmLFxuICBvbk1vdW50LFxuICBTaWduYWwsXG4gIHNpZ25hbCxcbiAgdmlldyxcbn0gZnJvbSBcIi4uL2RlcHMudHNcIjtcbmltcG9ydCB7IGdldFNvdXJjZXMgfSBmcm9tIFwiLi91c2UtYm9vcnUudHNcIjtcbmltcG9ydCB7IHVzZVBlcnZlcnQgfSBmcm9tIFwiLi91c2UtcGVydmVydC50c1wiO1xuaW1wb3J0IHsgU291cmNlRWRpdG9yIH0gZnJvbSBcIi4vc291cmNlLWVkaXRvci50c1wiO1xuaW1wb3J0IFRhZyBmcm9tIFwiLi90YWcudHNcIjtcblxuY29uc3QgTmF2aWdhdGlvbiA9IGNvbXBvbmVudCgoKSA9PiB7XG4gIGNvbnN0IHsgcG9zdFRhZ3MsIHRhZ3MsIHBhZ2UgfSA9IEJvb3J1O1xuXG4gIGNvbnN0IHNvdXJjZUVkaXQgPSBzaWduYWwoZmFsc2UpO1xuXG4gIGFkZEVsZW1lbnQoXCJuYXZcIiwgKCkgPT4ge1xuICAgIGNvbnN0IHJlZiA9IGVsZW1lbnRSZWYoKSE7XG5cbiAgICBTb3VyY2VFZGl0b3Ioc291cmNlRWRpdCk7XG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJuYXYtdG9wXCI7XG4gICAgICBJbnB1dHMoc291cmNlRWRpdCk7XG4gICAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICAgIGF0dHIuY2xhc3MgPSBcIm5hdi1wYWdpbmdcIjtcbiAgICAgICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIuY2xhc3MgPSBcInByZXZpb3VzXCI7XG4gICAgICAgICAgYXR0ci50ZXh0Q29udGVudCA9ICgpID0+IFN0cmluZyhwYWdlKCkgLSAxKTtcbiAgICAgICAgICBhdHRyLmRpc2FibGVkID0gKCkgPT4gcGFnZSgpIDw9IDE7XG4gICAgICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4gcGFnZShwYWdlKCkgLSAxKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgICBhdHRyLmNsYXNzID0gXCJjdXJyZW50XCI7XG4gICAgICAgICAgYXR0ci5kaXNhYmxlZCA9IHRydWU7XG4gICAgICAgICAgYXR0ci50ZXh0Q29udGVudCA9ICgpID0+IFN0cmluZyhwYWdlKCkpO1xuICAgICAgICB9KTtcbiAgICAgICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIuY2xhc3MgPSBcIm5leHRcIjtcbiAgICAgICAgICBhdHRyLnRleHRDb250ZW50ID0gKCkgPT4gU3RyaW5nKHBhZ2UoKSArIDEpO1xuICAgICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHBhZ2UocGFnZSgpICsgMSk7XG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJvdmVyZmxvdy1hdXRvIGZsZXgtMVwiO1xuICAgICAgdmlldygoKSA9PiB7XG4gICAgICAgIGNvbnN0IHNlbFRhZ3MgPSB0YWdzKCk7XG4gICAgICAgIG9uTW91bnQoKCkgPT4gcmVmLnNjcm9sbFRvKHsgdG9wOiAwLCBiZWhhdmlvcjogXCJzbW9vdGhcIiB9KSk7XG4gICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHRhZ3MoKSkgVGFnKHRhZyk7XG4gICAgICAgIGZvciAoY29uc3QgdGFnIG9mIHBvc3RUYWdzKCkuZmlsdGVyKCh0YWcpID0+ICFzZWxUYWdzLmluY2x1ZGVzKHRhZykpKSB7XG4gICAgICAgICAgVGFnKHRhZyk7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0pO1xuICB9KTtcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBOYXZpZ2F0aW9uO1xuXG5jb25zdCBJbnB1dHMgPSBjb21wb25lbnQoKHNvdXJjZUVkaXQ6IFNpZ25hbDxib29sZWFuPikgPT4ge1xuICBjb25zdCB7IHNlYXJjaCwgdXJsIH0gPSBCb29ydTtcbiAgY29uc3QgcGVydmVydCA9IHVzZVBlcnZlcnQoKTtcblxuICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgYXR0ci5jbGFzcyA9IFwiZmxleCBhbGlnbi1pdGVtcy1jZW50ZXJcIjtcblxuICAgIHZpZXcoKCkgPT4ge1xuICAgICAgaWYgKHBlcnZlcnQoKSA9PT0gZmFsc2UpIHJldHVybjtcbiAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci50aXRsZSA9IFwiY2hvb3NlIGltYWdlIHNvdXJjZVwiO1xuICAgICAgICBhdHRyLm5hbWUgPSBcInNvdXJjZVwiO1xuICAgICAgICBhdHRyLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJpY29uIHNvdXJjZSB6LWluZGV4LTFcIjtcbiAgICAgICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgIGF0dHIuY2xhc3MgPSBcInNvdXJjZXNcIjtcbiAgICAgICAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICAgICAgICBhdHRyLnRpdGxlID0gXCJvcGVuIHNvdXJjZSBlZGl0b3JcIjtcbiAgICAgICAgICAgIGF0dHIudGV4dENvbnRlbnQgPSBcInNvdXJjZSBlZGl0b3JcIjtcbiAgICAgICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IHNvdXJjZUVkaXQoIXNvdXJjZUVkaXQoKSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgICAgZm9yIChjb25zdCBzb3VyY2Ugb2YgZ2V0U291cmNlcygpKSB7XG4gICAgICAgICAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICAgICAgICAgIGF0dHIuYWN0aXZlID0gKCkgPT4gc291cmNlLnVybCA9PT0gdXJsKCk7XG4gICAgICAgICAgICAgIGF0dHIudGV4dENvbnRlbnQgPSBzb3VyY2UubmFtZTtcbiAgICAgICAgICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4gdXJsKHNvdXJjZS51cmwpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0pO1xuXG4gICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgYXR0ci50aXRsZSA9IFwiYnJvd3NlIHNvdXJjZVwiO1xuICAgICAgYXR0ci5uYW1lID0gXCJzb3VyY2Vjb2RlXCI7XG4gICAgICBhdHRyLnR5cGUgPSBcImJ1dHRvblwiO1xuICAgICAgYXR0ci5jbGFzcyA9IFwiaWNvbiBzb3VyY2Vjb2RlXCI7XG4gICAgICBhdHRyLm9uQ2xpY2sgPSAoKSA9PiB7XG4gICAgICAgIG9wZW4oXCJodHRwczovL2dpdGh1Yi5jb20vbWluaS1qYWlsL2J1cmF1emFcIiwgXCJfYmxhbmtcIik7XG4gICAgICB9O1xuICAgIH0pO1xuXG4gICAgYWRkRWxlbWVudChcImlucHV0XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLmNsYXNzID0gXCJmbGV4LTFcIjtcbiAgICAgIGF0dHIubmFtZSA9IFwic2VhcmNoXCI7XG4gICAgICBhdHRyLnBsYWNlaG9sZGVyID0gXCJzZWFyY2guLi5cIjtcbiAgICAgIGF0dHIudmFsdWUgPSBzZWFyY2g7XG4gICAgICBhdHRyLnR5cGUgPSBcInRleHRcIjtcbiAgICAgIGxldCBpZDogbnVtYmVyO1xuICAgICAgYXR0ci5vbktleVVwID0gKGV2KSA9PiB7XG4gICAgICAgIGNvbnN0IHZhbHVlID0gZXYuY3VycmVudFRhcmdldC52YWx1ZTtcbiAgICAgICAgY2xlYXJUaW1lb3V0KGlkKTtcbiAgICAgICAgaWQgPSBzZXRUaW1lb3V0KCgpID0+IHNlYXJjaCh2YWx1ZSksIDEwMDApO1xuICAgICAgfTtcbiAgICB9KTtcbiAgfSk7XG59KTtcbiIsImltcG9ydCB7IGFkZEVsZW1lbnQsIHJlbmRlciwgc2lnbmFsLCB2aWV3IH0gZnJvbSBcIi4uL2RlcHMudHNcIjtcblxudHlwZSBMb2FkaW5nUHJvcHMgPSB7XG4gIG9uOiAoKSA9PiBib29sZWFuO1xuICB0ZXh0OiAoKSA9PiBzdHJpbmc7XG59O1xuXG5jb25zdCBsb2FkcyA9IHNpZ25hbDxTZXQ8TG9hZGluZ1Byb3BzPj4obmV3IFNldCgpKTtcblxuZXhwb3J0IGZ1bmN0aW9uIHVzZUxvYWRpbmcoKSB7XG4gIGxldCB0aW1lb3V0SWQ6IG51bWJlcjtcbiAgcmVuZGVyKGRvY3VtZW50LmJvZHksICgpID0+IHtcbiAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICBhdHRyLnN0eWxlID0ge1xuICAgICAgICBwb3NpdGlvbjogXCJmaXhlZFwiLFxuICAgICAgICBib3R0b206IFwiMTBweFwiLFxuICAgICAgICByaWdodDogXCIxMHB4XCIsXG4gICAgICAgIGRpc3BsYXk6IFwiZmxleFwiLFxuICAgICAgICBmbGV4RGlyZWN0aW9uOiBcImNvbHVtblwiLFxuICAgICAgICBnYXA6IFwiMTBweFwiLFxuICAgICAgICB6SW5kZXg6IFwiOTk5OVwiLFxuICAgICAgICBwb2ludGVyRXZlbnRzOiBcIm5vbmVcIixcbiAgICAgIH07XG4gICAgICB2aWV3KCgpID0+IHtcbiAgICAgICAgZm9yIChjb25zdCBwcm9wcyBvZiBsb2FkcygpKSB7XG4gICAgICAgICAgYWRkRWxlbWVudChcImRpdlwiLCAoYXR0cikgPT4ge1xuICAgICAgICAgICAgYXR0ci5jbGFzcyA9IFwibG9hZGluZ1wiO1xuICAgICAgICAgICAgYXR0ci50ZXh0Q29udGVudCA9IHByb3BzLnRleHQ7XG4gICAgICAgICAgICBhdHRyLmxvYWRpbmcgPSAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdCA9IHByb3BzLm9uKCk7XG4gICAgICAgICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICAgICAgICBpZiAocHJvcHMub24oKSkge1xuICAgICAgICAgICAgICAgIGxvYWRzKCkuZGVsZXRlKHByb3BzKTtcbiAgICAgICAgICAgICAgICB0aW1lb3V0SWQgPSBzZXRUaW1lb3V0KCgpID0+IGxvYWRzKCgkKSA9PiAkISksIDIwMDApO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9KTtcbiAgfSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBsb2FkKHByb3BzOiBMb2FkaW5nUHJvcHMpIHtcbiAgcXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuICAgIGxvYWRzKGxvYWRzKCkuYWRkKHByb3BzKSk7XG4gIH0pO1xufVxuIiwiaW1wb3J0IHtcbiAgYWRkRWxlbWVudCxcbiAgY29tcG9uZW50LFxuICBjb21wdXRlZCxcbiAgZWZmZWN0LFxuICBvbkNsZWFudXAsXG4gIHNpZ25hbCxcbiAgdmlldyxcbn0gZnJvbSBcIi4uL2RlcHMudHNcIjtcbmltcG9ydCBCb29ydSBmcm9tIFwiLi4vY29udGV4dC50c1wiO1xuaW1wb3J0IFdpbmRvdyBmcm9tIFwiLi93aW5kb3cudHNcIjtcbmltcG9ydCBUYWcgZnJvbSBcIi4vdGFnLnRzXCI7XG5pbXBvcnQgeyBsb2FkIH0gZnJvbSBcIi4vbG9hZGluZy50c1wiO1xuXG5leHBvcnQgY29uc3QgUHJldmlldyA9IGNvbXBvbmVudCgoKSA9PiB7XG4gIGNvbnN0IHsgc2VsZWN0LCBwb3N0cyB9ID0gQm9vcnU7XG4gIGNvbnN0IHNvdXJjZSA9IHNpZ25hbDxzdHJpbmc+KFwiXCIpO1xuICBjb25zdCBzaG93ID0gc2lnbmFsKGZhbHNlKTtcblxuICBlZmZlY3QoKCkgPT4ge1xuICAgIGNvbnN0IGl0ZW0gPSBzZWxlY3QoKTtcbiAgICBzb3VyY2UoaXRlbT8uZmlsZVVybCk7XG4gICAgb25DbGVhbnVwKCgpID0+IHNob3coZmFsc2UpKTtcbiAgfSk7XG5cbiAgY29uc3Qgb25LZXlVcCA9IChldjogS2V5Ym9hcmRFdmVudCkgPT4ge1xuICAgIGlmIChldi5rZXkgPT09IFwiQXJyb3dSaWdodFwiKSBzaG93TmV4dCgpO1xuICAgIGVsc2UgaWYgKGV2LmtleSA9PT0gXCJBcnJvd0xlZnRcIikgc2hvd1ByZXZpb3VzKCk7XG4gIH07XG5cbiAgY29uc3Qgc2hvd1ByZXZpb3VzID0gKCkgPT4ge1xuICAgIGNvbnN0IGluZGV4ID0gcG9zdHMoKS5pbmRleE9mKHNlbGVjdCgpISk7XG4gICAgY29uc3QgcHJldiA9IChpbmRleCAtIDEpID09PSAtMSA/IHBvc3RzKCkubGVuZ3RoIC0gMSA6IGluZGV4IC0gMTtcbiAgICBzZWxlY3QocG9zdHMoKVtwcmV2XSk7XG4gIH07XG5cbiAgY29uc3Qgc2hvd05leHQgPSAoKSA9PiB7XG4gICAgY29uc3QgaW5kZXggPSBwb3N0cygpLmluZGV4T2Yoc2VsZWN0KCkhKTtcbiAgICBjb25zdCBuZXh0ID0gKGluZGV4ICsgMSkgPT09IHBvc3RzKCkubGVuZ3RoID8gMCA6IGluZGV4ICsgMTtcbiAgICBzZWxlY3QocG9zdHMoKVtuZXh0XSk7XG4gIH07XG5cbiAgV2luZG93KHtcbiAgICB0aXRsZTogKCkgPT4gU3RyaW5nKHNlbGVjdCgpPy5maWxlVXJsKSxcbiAgICBzaG93OiBzaG93LFxuICAgIHdpZHRoOiBcIjEwMHZ3XCIsXG4gICAgb25PcGVuOiAoKSA9PiBhZGRFdmVudExpc3RlbmVyKFwia2V5dXBcIiwgb25LZXlVcCksXG4gICAgb25DbG9zZTogKCkgPT4gcmVtb3ZlRXZlbnRMaXN0ZW5lcihcImtleXVwXCIsIG9uS2V5VXApLFxuICAgIHRpdGxlQ2hpbGRyZW4oKSB7XG4gICAgICBhZGRFbGVtZW50KFwiYnV0dG9uXCIsIChhdHRyKSA9PiB7XG4gICAgICAgIGF0dHIuY2xhc3MgPSBcImljb24gbGVmdFwiO1xuICAgICAgICBhdHRyLm9uQ2xpY2sgPSBzaG93UHJldmlvdXM7XG4gICAgICB9KTtcbiAgICAgIGFkZEVsZW1lbnQoXCJidXR0b25cIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci5jbGFzcyA9IFwiaWNvbiByaWdodFwiO1xuICAgICAgICBhdHRyLm9uQ2xpY2sgPSBzaG93TmV4dDtcbiAgICAgIH0pO1xuICAgICAgYWRkRWxlbWVudChcImJ1dHRvblwiLCAoYXR0cikgPT4ge1xuICAgICAgICBhdHRyLmNsYXNzID0gXCJpY29uIGN1cmx5LWFycm93XCI7XG4gICAgICAgIGF0dHIudGl0bGUgPSBcIm9wZW4gZmlsZSBpbiBuZXcgdGFiXCI7XG4gICAgICAgIGF0dHIub25DbGljayA9ICgpID0+IG9wZW4oc2VsZWN0KCkhLmZpbGVVcmwsIFwiX2JsYW5rXCIpO1xuICAgICAgfSk7XG4gICAgfSxcbiAgICBjaGlsZHJlbigpIHtcbiAgICAgIGFkZEVsZW1lbnQoXCJkaXZcIiwgKGF0dHIpID0+IHtcbiAgICAgICAgYXR0ci5zdHlsZSA9IGBcbiAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgIGdhcDogMTBweDtcbiAgICAgICAgICBhbGlnbi1pdGVtczogZmxleC1zdGFydDtcbiAgICAgICAgYDtcbiAgICAgICAgdmlldygoKSA9PiB7XG4gICAgICAgICAgY29uc3QgcG9zdCA9IHNlbGVjdCgpO1xuICAgICAgICAgIGlmIChwb3N0ID09PSB1bmRlZmluZWQpIHJldHVybjtcbiAgICAgICAgICBpZiAoc291cmNlKCkgPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuICAgICAgICAgIGxvYWQoeyBvbjogc2hvdywgdGV4dDogKCkgPT4gYGxvYWRpbmcgJHtwb3N0LmlkfWAgfSk7XG5cbiAgICAgICAgICBhZGRFbGVtZW50KFwiaW1nXCIsIChhdHRyKSA9PiB7XG4gICAgICAgICAgICBhdHRyLnN0eWxlID0gYFxuICAgICAgICAgICAgICBvYmplY3QtZml0OiBjb250YWluO1xuICAgICAgICAgICAgICBmbGV4OiAxO1xuICAgICAgICAgICAgICB3aWR0aDogNTAwcHg7XG4gICAgICAgICAgICAgIG1pbi13aWR0aDogNTAwcHg7XG4gICAgICAgICAgICBgO1xuICAgICAgICAgICAgYXR0ci5zcmMgPSBzb3VyY2UoKTtcbiAgICAgICAgICAgIGF0dHIuYWx0ID0gcG9zdC5maWxlVXJsIHx8IFwiXCI7XG4gICAgICAgICAgICBhdHRyLm9uTG9hZCA9ICgpID0+IHNob3codHJ1ZSk7XG4gICAgICAgICAgICBhdHRyLm9uRXJyb3IgPSAoKSA9PiBzb3VyY2UocG9zdC5wcmV2aWV3VXJsKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBhZGRFbGVtZW50KFwiZGl2XCIsIChhdHRyKSA9PiB7XG4gICAgICAgICAgICBhdHRyLnN0eWxlID0gYFxuICAgICAgICAgICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgICAgICAgICBnYXA6IDVweDtcbiAgICAgICAgICAgICAgZmxleC13cmFwOiB3cmFwO1xuICAgICAgICAgICAgfWA7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IHRhZyBvZiBwb3N0LnRhZ3MpIFRhZyh0YWcpO1xuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH0sXG4gIH0pO1xufSk7XG5cbmV4cG9ydCBkZWZhdWx0IFByZXZpZXc7XG4iLCJpbXBvcnQgeyBhZGRFbGVtZW50LCBjb21wb25lbnQsIGVsZW1lbnRSZWYsIG9uTW91bnQsIHZpZXcgfSBmcm9tIFwiLi4vZGVwcy50c1wiO1xuaW1wb3J0IEJvb3J1IGZyb20gXCIuLi9jb250ZXh0LnRzXCI7XG5pbXBvcnQgeyBsb2FkIH0gZnJvbSBcIi4vbG9hZGluZy50c1wiO1xuXG5leHBvcnQgY29uc3QgUG9zdHMgPSBjb21wb25lbnQoKCkgPT4ge1xuICBjb25zdCB7IHBvc3RzLCBoaWdobGlnaHRlZCwgc2VsZWN0LCBsb2FkZWQsIHNpemUgfSA9IEJvb3J1O1xuXG4gIGFkZEVsZW1lbnQoXCJtYWluXCIsIChhdHRyKSA9PiB7XG4gICAgY29uc3QgcmVmID0gZWxlbWVudFJlZigpITtcbiAgICBhdHRyLnJlYWR5ID0gKCkgPT4gc2l6ZSgpIDw9IGxvYWRlZCgpO1xuICAgIHZpZXcoKCkgPT4ge1xuICAgICAgbG9hZCh7XG4gICAgICAgIG9uOiAoKSA9PiBzaXplKCkgPD0gbG9hZGVkKCksXG4gICAgICAgIHRleHQ6ICgpID0+IGBsb2FkaW5nIHBvc3RzICR7bG9hZGVkKCl9LyR7c2l6ZSgpfWAsXG4gICAgICB9KTtcbiAgICAgIG9uTW91bnQoKCkgPT4gcmVmLnNjcm9sbFRvKHsgdG9wOiAwLCBiZWhhdmlvcjogXCJzbW9vdGhcIiB9KSk7XG4gICAgICBmb3IgKGNvbnN0IHBvc3Qgb2YgcG9zdHMoKSkge1xuICAgICAgICBhZGRFbGVtZW50KFwiYXJ0aWNsZVwiLCAoKSA9PiB7XG4gICAgICAgICAgYWRkRWxlbWVudChcImltZ1wiLCAoYXR0cikgPT4ge1xuICAgICAgICAgICAgYXR0ci5zcmMgPSBwb3N0LnByZXZpZXdVcmw7XG4gICAgICAgICAgICBhdHRyLmFsdCA9IGF0dHIuc3JjO1xuICAgICAgICAgICAgYXR0ci5vbkNsaWNrID0gKCkgPT4gc2VsZWN0KHBvc3QpO1xuICAgICAgICAgICAgYXR0ci5vbkxvYWQgPSAoKSA9PiBsb2FkZWQobG9hZGVkKCkgKyAxKTtcbiAgICAgICAgICAgIGF0dHIub25FcnJvciA9IGF0dHIub25Mb2FkO1xuICAgICAgICAgICAgYXR0ci5vbk1vdXNlT3ZlciA9ICgpID0+IGhpZ2hsaWdodGVkKHBvc3QudGFncyk7XG4gICAgICAgICAgICBhdHRyLm9uTW91c2VPdXQgPSAoKSA9PiBoaWdobGlnaHRlZChbXSk7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9KTtcbn0pO1xuXG5leHBvcnQgZGVmYXVsdCBQb3N0cztcbiIsImltcG9ydCB7IGNvbXBvbmVudCwgcmVuZGVyIH0gZnJvbSBcIi4vZGVwcy50c1wiO1xuaW1wb3J0IE5hdmlnYXRpb24gZnJvbSBcIi4vY29tcG9uZW50cy9uYXZpZ2F0aW9uLnRzXCI7XG5pbXBvcnQgUHJldmlldyBmcm9tIFwiLi9jb21wb25lbnRzL3ByZXZpZXcudHNcIjtcbmltcG9ydCBQb3N0cyBmcm9tIFwiLi9jb21wb25lbnRzL3Bvc3RzLnRzXCI7XG5pbXBvcnQgeyB1c2VMb2FkaW5nIH0gZnJvbSBcIi4vY29tcG9uZW50cy9sb2FkaW5nLnRzXCI7XG5cbmNvbnN0IEFwcCA9IGNvbXBvbmVudCgoKSA9PiB7XG4gIE5hdmlnYXRpb24oKTtcbiAgUG9zdHMoKTtcbiAgUHJldmlldygpO1xufSk7XG5cbmNvbnN0IF9jbGVhbnVwID0gcmVuZGVyKGRvY3VtZW50LmJvZHksICgpID0+IHtcbiAgdXNlTG9hZGluZygpO1xuICBBcHAoKTtcbn0pO1xuIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQThCQSxNQUFNLFFBQVE7QUFDZCxNQUFNLFFBQVEsSUFBSTtBQUNsQixJQUFJO0FBQ0osSUFBSTtBQUVHLFNBQVMsT0FBZ0IsUUFBaUMsRUFBWTtJQUMzRSxNQUFNLE9BQU87SUFDYixhQUFhO0lBQ2IsSUFBSTtRQUNGLE9BQU8sTUFBTSxJQUFNO1lBQ2pCLElBQUksV0FBb0M7WUFDeEMsSUFBSSxTQUFTLE1BQU0sRUFBRTtnQkFDbkIsV0FBVyxVQUFVLElBQUksQ0FBQyxXQUFXLE1BQU0sSUFBSTtZQUNqRCxDQUFDO1lBQ0QsT0FBTyxTQUFTO1FBQ2xCO0lBQ0YsRUFBRSxPQUFPLE9BQU87UUFDZCxZQUFZO0lBQ2QsU0FBVTtRQUNSLGFBQWEsS0FBSyxVQUFVO0lBQzlCO0FBQ0Y7QUFZQSxTQUFTLFdBQ1AsWUFBa0IsRUFDbEIsUUFBNEMsRUFDckI7SUFDdkIsTUFBTSxPQUFhO1FBQ2pCLE9BQU87UUFDUDtRQUNBLFVBQVU7UUFDVixZQUFZO1FBQ1osVUFBVTtRQUNWO1FBQ0EsU0FBUztRQUNULGFBQWE7SUFDZjtJQUNBLElBQUksWUFBWTtRQUNkLElBQUksV0FBVyxRQUFRLEtBQUssV0FBVztZQUNyQyxXQUFXLFFBQVEsR0FBRztnQkFBQzthQUFLO1FBQzlCLE9BQU87WUFDTCxXQUFXLFFBQVEsQ0FBQyxJQUFJLENBQUM7UUFD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
