var Le=Symbol(),Me=new Set,A,c;function S(e){let t=q();c=t;try{return X(()=>{let n;return e.length&&(n=D.bind(void 0,t,!0)),e(n)})}catch(n){Q(n)}finally{c=t.parentNode}}function q(e,t){let n={value:e,parentNode:c,children:void 0,injections:void 0,cleanups:void 0,callback:t,sources:void 0,sourceSlots:void 0};return c&&(c.children===void 0?c.children=[n]:c.children.push(n)),n}function _(e){b(()=>O(e))}function $(e){y(()=>O(e))}function h(e,t){return n=>(e(),O(()=>t(n)))}function b(e,t){if(c){let n=q(t,e);A?A.add(n):queueMicrotask(()=>Y(n,!1))}else queueMicrotask(()=>e(t))}function K(e,t){return e?e.injections&&t in e.injections?e.injections[t]:K(e.parentNode,t):void 0}function He(e){return{value:e,nodes:void 0,nodeSlots:void 0}}function Ae(e){if(c&&c.callback){let t=e.nodes?.length||0,n=c.sources?.length||0;c.sources===void 0?(c.sources=[e],c.sourceSlots=[t]):(c.sources.push(e),c.sourceSlots.push(t)),e.nodes===void 0?(e.nodes=[c],e.nodeSlots=[n]):(e.nodes.push(c),e.nodeSlots.push(n))}return e.value}function he(e,t){typeof t=="function"&&(t=t(e.value)),e.value=t,e.nodes?.length&&X(()=>{for(let n of e.nodes)A.add(n)})}function ve(e,t){return arguments.length===1?Ae(e):he(e,t)}function g(e){let t=He(e);return ve.bind(void 0,t)}function Q(e){let t=K(c,Le);if(!t)return reportError(e);for(let n of t)n(e)}function y(e){c!==void 0&&(c.cleanups?c.cleanups.push(e):c.cleanups=[e])}function O(e){let t=c;c=void 0;let n=e();return c=t,n}function X(e){if(A)return e();A=Me;let t=e();return queueMicrotask(Ee),t}function Ee(){if(A!==void 0){for(let e of A)A.delete(e),Y(e,!1);A=void 0}}function Y(e,t){if(D(e,t),e.callback===void 0)return;let n=c;c=e;try{e.value=e.callback(e.value)}catch(i){Q(i)}finally{c=n}}function Se(e){let t,n,i,r;for(;e.sources.length;)t=e.sources.pop(),n=e.sourceSlots.pop(),t.nodes?.length&&(i=t.nodes.pop(),r=t.nodeSlots.pop(),n<t.nodes.length&&(t.nodes[n]=i,t.nodeSlots[n]=r,i.sourceSlots[r]=n))}function ke(e,t){let n=e.callback!==void 0,i;for(;e.children.length;)i=e.children.pop(),D(i,t||n&&i.callback!==void 0)}function D(e,t){e.sources?.length&&Se(e),e.children?.length&&ke(e,t),e.cleanups?.length&&xe(e),e.injections=void 0,t&&ye(e)}function xe(e){for(;e.cleanups?.length;)e.cleanups.pop()()}function ye(e){e.value=void 0,e.parentNode=void 0,e.children=void 0,e.cleanups=void 0,e.callback=void 0,e.sources=void 0,e.sourceSlots=void 0}var v,C,G,w=new Set;function ne(){return G}function s(e,t){let n=document.createElement(e);t&&ie(n,t),Ne(n)}function ie(e,t){if(typeof t=="object")return te(e,void 0,t);e.append(""),b(n=>{let i=C=[];if(v=t.length?Object.create(null):void 0,G=e,t(v),(n?.[1]?.length||i.length)&&we(e.firstChild,n?.[1],i),G=void 0,C=void 0,(n?.[0]||v)&&te(e,n?.[0],v),v=void 0,v||i.length)return[v,i]})}function Ne(e){C?C.push(e):G?.appendChild(e)}function we(e,t,n){let i=e.parentNode;if(t===void 0){for(let m of n)i.insertBefore(m,e);return}let r=t.length,o=n.length,l,a,u;e:for(a=0;a<o;a++){for(l=t[a],u=0;u<r;u++)if(t[u]!==void 0&&(t[u].nodeType===3&&n[a].nodeType===3?(t[u].data!==n[a].data&&(t[u].data=n[a].data),n[a]=t[u]):t[u].isEqualNode(n[a])&&(n[a]=t[u]),n[a]===t[u])){if(t[u]=void 0,a===u)continue e;break}i.insertBefore(n[a],l?.nextSibling||null)}for(;t.length;)t.pop()?.remove()}function J(e){return e.replace(/([A-Z])/g,t=>"-"+t[0]).toLowerCase()}function Z(e){return e.startsWith("on:")?e.slice(3):e.slice(2).toLowerCase()}function ee(e,t,n){if(t==="text"||t==="textContent")e.firstChild?.nodeType===3?e.firstChild.data=String(n):e.prepend(String(n));else if(typeof n=="object")for(let i in n)typeof n[i]=="function"?b(r=>{let o=n[i]();return o!==r&&(e[t][i]=o||null),o}):e[t][i]=n[i]||null;else t in e?e[t]=n:n!==void 0?e.setAttributeNS(null,J(t),String(n)):e.removeAttributeNS(null,J(t))}function te(e,t,n){w.clear(),t&&Object.keys(t).forEach(r=>w.add(r)),n&&Object.keys(n).forEach(r=>w.add(r));let i;for(let r of w){let o=n?.[r],l=t?.[r];o===void 0&&l===void 0||(r.startsWith("on")&&l!==o?(l&&e.removeEventListener(Z(r),t[r]),o&&e.addEventListener(Z(r),n[r])):typeof o=="function"?i===void 0?i=[r]:i.push(r):ee(e,r,n?.[r]))}i&&b(r=>{for(let o of i){let l=n[o]();r[o]!==l&&(ee(e,o,l),r[o]=l)}return r},{})}function B(e,t){return S(n=>(ie(e,t),n))}var Ce=await Be(),L=g(Ge()),F=S(()=>{let e=()=>[...Ce,...L()];return b(t=>{let n=L();if(t===!0)return!1;localStorage.setItem("sources",JSON.stringify(n))},!0),e});function Ge(){let e=localStorage.getItem("sources")||"[]";try{return JSON.parse(e)}catch{return[]}}async function Be(){try{return await(await fetch("./sources.json")).json()}catch{return[]}}function re(){return F()}function Pe(e){return F().find(t=>t.url===e)}function ae(){return F()[0]}function se(e){let t=g([]);return b(async()=>{let{page:n=1,limit:i=40,url:r,tags:o}=e(),l=[],a=Pe(r)?.url||r;if(a){let u=new URL(a),m=new URLSearchParams;m.set("page",n.toString()),m.set("limit",i.toString()),o?.length&&m.set("tags",o.join(" ")),u.search=m.toString();let p=await fetch(u);if(p.ok){let V=await p.json();for(let f of(Array.isArray(V)?V:V.post)||[])f.id!==void 0&&f.file_url!==void 0&&(f.preview_url===void 0&&f.preview_file_url===void 0||l.push(Re(r,f)))}}t(l)}),t}function Re(e,t){let n={id:t.id,fileUrl:t.file_url,previewUrl:t.preview_url||t.preview_file_url,artist:t.tag_string_artist||void 0,tags:[],source:e},i=t.tags||t.tag_string;return i&&n.tags.push(...i.split(" ").filter(r=>r)),n}function oe(e){let t=document.title;b(()=>document.title=e()),$(()=>document.title=t)}var ue=()=>{let e=location.hash;return e.startsWith("#")&&(e=e.slice(1)),e},le=()=>{let e=new URLSearchParams(ue());return{url:e.has("url")?e.get("url"):ae()?.url,page:e.has("page")?~~e.get("page"):1,limit:e.has("limit")?~~e.get("limit"):40,search:e.has("search")?e.get("search"):"",tags:e.has("tags")?e.get("tags").split(",").filter(t=>t):[]}},M=S(()=>{let e=le(),t=g(e.url),n=g(e.limit),i=g(0),r=g(1/0),o=g(e.search),l=g(),a=g(e.tags),u=g(e.page),m=g(),p=se(()=>({url:t(),limit:n(),page:u(),tags:a()})),V=()=>{let d=[];for(let T of p())for(let H of T.tags)d.includes(H)===!1&&d.push(H);return d.sort((T,H)=>T<H?-1:T>H?1:0)},f=d=>!I(d)&&a([...a(),d]),E=d=>a(a().filter(T=>T!==d)),pe=d=>I(d)?E(d):f(d),I=d=>a().includes(d),Ve=()=>(t(),a(),void 0),W=d=>{let T=le();t(T.url),u(T.page),n(T.limit),o(T.search),a(T.tags)};return b(h(o,d=>{if(d!==o()){let T=o().split(" ").filter(H=>H);for(let H of T)f(H);u(1)}return o()}),e.search),oe(()=>{let d=`\u30D6\u30E9\u30A6\u30B6\uFF1A${u()}`;return a().length&&(d+=` \u300C${a().join("\u3001 ")}\u300D`),d}),b(h(p,()=>{r(p().length),i(0)})),b(h(Ve,d=>{let T=`${t()}${a().join()}`;return d!==T&&u(1),T}),`${t()}${a().join()}`),b(d=>(d.set("page",u().toString()),d.set("limit",n().toString()),d.set("url",t()),o().length?d.set("search",o()):d.delete("search"),a().length?d.set("tags",a().join(",")):d.delete("tags"),removeEventListener("popstate",W),location.hash=d.toString(),addEventListener("popstate",W),d),new URLSearchParams(ue())),{highlighted:l,tags:a,posts:p,postTags:V,page:u,select:m,addTag:f,delTag:E,hasTag:I,toggleTag:pe,search:o,loaded:i,size:r,limit:n,url:t}});function de(){let e=localStorage.getItem("is:pervert")==="true",t="imapervert".split(""),n=g(e),i=0,r=({key:o})=>{if(i===t.length-1){localStorage.setItem("is:pervert","true"),n(!0);return}o!=null&&t[i]!=null&&o.toLowerCase()===t[i].toLowerCase()?i++:(i=0,n(!1))};return b(()=>{y(()=>removeEventListener("keyup",r)),!n()&&addEventListener("keyup",r)}),n}function ge(e,t){return new Promise(n=>{let i=document.createElement("input");i.type="file",i.accept=e,i.onchange=r=>{let o=r.currentTarget.files;if(o===null)return;let l=new FileReader;l.onload=()=>{n(l.result)},l[t](o[0])},i.click()})}function ce(e,t,n){let i=`${t};charset=utf-8,${encodeURIComponent(n)}`,r=document.createElement("a");r.href="data:"+i,r.download=e,r.click()}function N(e){let t=g(!1),n=g(!1),i=()=>n(!n()),r=()=>t(!1),o=()=>`${n()?"compress":"enlarge"} window`,l=()=>`icon ${n()?"compress":"enlarge"}`;b(h(e.show,()=>t(e.show()))),b(h(t,()=>t()?e.onOpen?.():e.onClose?.())),s("div",a=>{a.show=t,a.class="window",a.fullscreen=n,a.style={width:e.width,height:e.height},s("div",u=>{u.class="window-title",s("h3",{title:e.title,textContent:e.title}),s("div",m=>{m.class="window-title-children",e.titleChildren?.(),s("button",{type:"button",class:l,title:o,onClick:i}),s("button",{class:"icon close",type:"button",title:"close window",onClick:r})})}),s("div",u=>{u.class="window-content",s("div",m=>{m.class="window-content-wrapper",e.children?.()})})})}function be(e){N({title:()=>"source editor",show:e,titleChildren(){s("button",{class:"icon download-json",title:"download sources",onClick(){ce(`sources-${Date.now()}.json`,"application/json",JSON.stringify(L(),null,2))}})},children(){for(let t of L())Oe(t);Ie()}})}function Ie(){let e=g(""),t=g("");s("div",n=>{n.class="flex justify-content-space-betwee flex-gap-10",s("div",i=>{i.class="flex align-items-baseline width-100",s("label",{textContent:"name:"}),s("input",{class:"flex-1",name:"name",value:e,onInput(r){e(r.currentTarget.value)},placeholder:"*Booru"})}),s("div",i=>{i.class="flex align-items-baseline width-100",s("label",{textContent:"url:"}),s("input",{class:"flex-1",name:"url",value:t,onInput:r=>t(r.currentTarget.value),placeholder:"https://..."})}),s("div",i=>{i.class="flex",s("button",{class:"icon plus",title:"add source",disabled:()=>!e()||!t(),onClick(){!e()||!t()||(L(L().concat({name:e(),url:t()})),t(""),e(""))}}),s("button",{class:"icon import",title:"import source",async onClick(){let r=await ge(".json","readAsText"),o=JSON.parse(r),l=[];if(Array.isArray(o))for(let a of o)a.name&&a.url&&l.push(a);L(L().concat(l))}})})})}function Oe(e){s("div",t=>{t.class="flex justify-content-space-between flex-gap-10",s("div",n=>{n.class="flex align-items-baseline width-100",s("label",{textContent:"name:"}),s("input",{class:"flex-1",name:"name",value:e.name,placeholder:"*Booru",onInput(i){e.name=i.currentTarget.value}})}),s("div",n=>{n.class="flex align-items-baseline width-100",s("label",{textContent:"url:"}),s("input",{class:"flex-1",value:e.url,placeholder:"https://...",onInput(i){e.url=i.currentTarget.value}})}),s("div",n=>{n.class="flex",s("button",{class:"icon check",title:"save source",onClick(){let i={url:e.url,name:e.name};L(L().filter(r=>r!==e).concat(i))}}),s("button",{class:"icon delete",title:"delete source",onClick(){L(L().filter(i=>i!==e))}})})})}var P=new Map;function me(e,t){let n=g(e);return b(h(t,async()=>{if(t()===!1)return n(e);if(P.has(e))return n(P.get(e));let i=await fetch(`https://danbooru.donmai.us/wiki_pages/${e}.json`);i.status===200?P.set(e,(await i.json()).body):P.set(e,e)})),n}addEventListener("click",e=>{let t=e.target?.dataset?.tag;t&&M.toggleTag(t)});function De(){return M.tags().includes(this)?"active":M.highlighted()?.includes(this)?"highlight":"inactive"}function k(e,t){let n=g(!1),i=me(e,n);s("div",{class:"tag",title:i,textContent:e,dataTag:e,artist:t?.artist===e,onMouseOver:()=>n(!0),onMouseOut:()=>n(!1),state:De.bind(e)})}function j(){let{postTags:e,tags:t,page:n,search:i,url:r}=M,o=g(!1),l=g(!1),a=de(),u;s("nav",()=>{be(l),s("div",m=>{m.class="nav-top",s("div",p=>{p.class="flex align-items-center",a()&&s("button",V=>{V.title="choose image source",V.name="source",V.type="button",V.class="icon source z-index-1",s("div",f=>{f.class="sources",s("div",{title:"open source editor",textContent:"source editor",onClick:()=>l(!l())});for(let E of re())s("div",{active:()=>E.url===r(),textContent:E.name,onClick:()=>r(E.url)})})}),s("button",{class:"icon tags",title:"show tags",onClick:()=>o(!o())}),s("input",{class:"flex-1",name:"search",placeholder:"search...",value:i,type:"text",onKeyUp(V){let f=V.currentTarget.value;clearTimeout(u),u=setTimeout(()=>i(f),1e3)}}),s("button",{title:"browse source",name:"sourcecode",type:"button",class:"icon sourcecode",onClick(){open("https://github.com/mini-jail/burauza","_blank")}})}),s("div",p=>{p.class="nav-paging",s("button",{title:"show previous page",class:"previous",textContent:()=>String(n()-1),disabled:()=>n()<=1,onClick:()=>n(n()-1)}),s("button",{title:"current page",class:"current",disabled:!0,textContent:()=>String(n())}),s("button",{title:"show next page",class:"next",textContent:()=>String(n()+1),onClick:()=>n(n()+1)})})}),s("div",m=>{m.class="tag-list overflow-auto flex-1",m.show=o;let p=t(),V=e().filter(f=>!p.includes(f));for(let f of p)k(f);for(let f of V)k(f)})})}var x=g(new Set);function fe(){B(document.body,()=>{s("div",e=>{e.class="loading-wrapper";for(let t of x())s("div",{class:"loading",textContent:t.text,loading:()=>{let n=t.on();return t.on()&&(x().delete(t),x(x())),n}})})})}function R(e){queueMicrotask(()=>x(x().add(e)))}var Fe=["jpg","jpeg","bmp","png","gif"],je=e=>e.split(".").at(-1),Ue=e=>{let t=je(e);return t===void 0?!1:Fe.includes(t)};function U(){let{select:e,posts:t}=M,n=g(!1);y(()=>n(!1));let i=l=>{l.key==="ArrowRight"?o():l.key==="ArrowLeft"&&r()},r=()=>{let l=t().indexOf(e()),a=l-1===-1?t().length-1:l-1;e(t()[a])},o=()=>{let l=t().indexOf(e()),a=l+1===t().length?0:l+1;e(t()[a])};N({title:()=>String(e()?.fileUrl),show:n,width:"100%",onOpen:()=>addEventListener("keyup",i),onClose:()=>removeEventListener("keyup",i),titleChildren(){s("button",{title:"show previous post",class:"icon left",onClick:r}),s("button",{title:"show next post",class:"icon right",onClick:o}),s("button",{title:"open file in new tab",class:"icon curly-arrow",onClick:()=>open(e().fileUrl,"_blank")})},children(){s("div",l=>{l.class="preview";let a=e();a!==void 0&&(R({on:n,text:()=>`loading "${a.id}"`}),s("img",{class:"preview-img",src:Ue(a.fileUrl)?a.fileUrl:a.previewUrl,alt:a.fileUrl,onLoad:()=>n(!0),onError:u=>{u.currentTarget.src===a.fileUrl&&(u.currentTarget.src=a.previewUrl)}}),s("div",u=>{u.class="tag-list";for(let m of a.tags)k(m,a)}))})}})}function Te(){M.loaded(M.loaded()+1)}function ze(){M.highlighted(void 0)}function z(){let{posts:e,highlighted:t,select:n,loaded:i,size:r}=M;s("main",o=>{let l=ne();o.ready=()=>r()<=i(),R({on:()=>r()<=i(),text:()=>`loading posts ${i()}/${r()}`}),_(()=>l.scrollTo({top:0,behavior:"smooth"}));for(let a of e())s("article",()=>{s("img",{src:a.previewUrl,alt:a.previewUrl,onClick:()=>n(a),onLoad:Te,onError:Te,onMouseOver:()=>t(a.tags),onMouseOut:ze})})})}fe();B(document.body,()=>{j(),z(),U()});
//# sourceMappingURL=app.js.map
