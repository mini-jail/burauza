var Ve=Symbol(),Le=new Set,H,c;function v(e){let t=q();c=t;try{return X(()=>{let n;return e.length&&(n=D.bind(void 0,t,!0)),e(n)})}catch(n){Q(n)}finally{c=t.parentNode}}function q(e,t){let n={value:e,parentNode:c,children:void 0,injections:void 0,cleanups:void 0,callback:t,sources:void 0,sourceSlots:void 0};return c&&(c.children===void 0?c.children=[n]:c.children.push(n)),n}function _(e){b(()=>O(e))}function $(e){x(()=>O(e))}function E(e,t){return n=>(e(),O(()=>t(n)))}function b(e,t){if(c){let n=q(t,e);H?H.add(n):queueMicrotask(()=>Y(n,!1))}else queueMicrotask(()=>e(t))}function K(e,t){return e?e.injections&&t in e.injections?e.injections[t]:K(e.parentNode,t):void 0}function Me(e){return{value:e,nodes:void 0,nodeSlots:void 0}}function He(e){if(c&&c.callback){let t=e.nodes?.length||0,n=c.sources?.length||0;c.sources===void 0?(c.sources=[e],c.sourceSlots=[t]):(c.sources.push(e),c.sourceSlots.push(t)),e.nodes===void 0?(e.nodes=[c],e.nodeSlots=[n]):(e.nodes.push(c),e.nodeSlots.push(n))}return e.value}function Ae(e,t){typeof t=="function"&&(t=t(e.value)),e.value=t,e.nodes?.length&&X(()=>{for(let n of e.nodes)H.add(n)})}function he(e,t){return arguments.length===1?He(e):Ae(e,t)}function g(e){let t=Me(e);return he.bind(void 0,t)}function Q(e){let t=K(c,Ve);if(!t)return reportError(e);for(let n of t)n(e)}function x(e){c!==void 0&&(c.cleanups?c.cleanups.push(e):c.cleanups=[e])}function O(e){let t=c;c=void 0;let n=e();return c=t,n}function X(e){if(H)return e();H=Le;let t=e();return queueMicrotask(ve),t}function ve(){if(H!==void 0){for(let e of H)H.delete(e),Y(e,!1);H=void 0}}function Y(e,t){if(D(e,t),e.callback===void 0)return;let n=c;c=e;try{e.value=e.callback(e.value)}catch(i){Q(i)}finally{c=n}}function Ee(e){let t,n,i,s;for(;e.sources.length;)t=e.sources.pop(),n=e.sourceSlots.pop(),t.nodes?.length&&(i=t.nodes.pop(),s=t.nodeSlots.pop(),n<t.nodes.length&&(t.nodes[n]=i,t.nodeSlots[n]=s,i.sourceSlots[s]=n))}function Se(e,t){let n=e.callback!==void 0,i;for(;e.children.length;)i=e.children.pop(),D(i,t||n&&i.callback!==void 0)}function D(e,t){e.sources?.length&&Ee(e),e.children?.length&&Se(e,t),e.cleanups?.length&&ke(e),e.injections=void 0,t&&xe(e)}function ke(e){for(;e.cleanups?.length;)e.cleanups.pop()()}function xe(e){e.value=void 0,e.parentNode=void 0,e.children=void 0,e.cleanups=void 0,e.callback=void 0,e.sources=void 0,e.sourceSlots=void 0}var h,C,G,w=new Set;function ne(){return G}function a(e,t){let n=document.createElement(e);t&&ie(n,t),ye(n)}function ie(e,t){if(typeof t=="object")return te(e,void 0,t);e.append(""),b(n=>{let i=C=[];if(h=t.length?Object.create(null):void 0,G=e,t(h),(n?.[1]?.length||i.length)&&Ne(e.firstChild,n?.[1],i),G=void 0,C=void 0,(n?.[0]||h)&&te(e,n?.[0],h),h=void 0,h||i.length)return[h,i]})}function ye(e){C?C.push(e):G?.appendChild(e)}function Ne(e,t,n){let i=e.parentNode;if(t===void 0){for(let m of n)i.insertBefore(m,e);return}let s=t.length,u=n.length,l,r,o;e:for(r=0;r<u;r++){for(l=t[r],o=0;o<s;o++)if(t[o]!==void 0&&(t[o].nodeType===3&&n[r].nodeType===3?(t[o].data!==n[r].data&&(t[o].data=n[r].data),n[r]=t[o]):t[o].isEqualNode(n[r])&&(n[r]=t[o]),n[r]===t[o])){if(t[o]=void 0,r===o)continue e;break}i.insertBefore(n[r],l?.nextSibling||null)}for(;t.length;)t.pop()?.remove()}function J(e){return e.replace(/([A-Z])/g,t=>"-"+t[0]).toLowerCase()}function Z(e){return e.startsWith("on:")?e.slice(3):e.slice(2).toLowerCase()}function ee(e,t,n){t==="text"||t==="textContent"?e.firstChild?.nodeType===3?e.firstChild.data=String(n):e.prepend(String(n)):t in e?e[t]=n:n!==void 0?e.setAttributeNS(null,J(t),String(n)):e.removeAttributeNS(null,J(t))}function te(e,t,n){w.clear(),t&&Object.keys(t).forEach(i=>w.add(i)),n&&Object.keys(n).forEach(i=>w.add(i));for(let i of w){let s=n?.[i],u=t?.[i];if(!(s===void 0&&u===void 0))if(i.startsWith("on")&&u!==s)u&&e.removeEventListener(Z(i),t[i]),s&&e.addEventListener(Z(i),n[i]);else if(typeof s=="function")b(l=>{let r=s();return r!==l&&ee(e,i,r),r});else if(typeof s=="object")for(let l in s)typeof s[l]=="function"?b(r=>{console.log(s[l]);let o=s[l]();return o!==r&&(e[i][l]=o||null),o}):e[i][l]=s[l]||null;else ee(e,i,n?.[i])}}function B(e,t){return v(n=>(ie(e,t),n))}var we=await Ge(),L=g(Ce()),F=v(()=>{let e=()=>[...we,...L()];return b(t=>{let n=L();if(t===!0)return!1;localStorage.setItem("sources",JSON.stringify(n))},!0),e});function Ce(){let e=localStorage.getItem("sources")||"[]";try{return JSON.parse(e)}catch{return[]}}async function Ge(){try{return await(await fetch("./sources.json")).json()}catch{return[]}}function re(){return F()}function Be(e){return F().find(t=>t.url===e)}function ae(){return F()[0]}function se(e){let t=g([]);return b(async()=>{let{page:n=1,limit:i=40,url:s,tags:u}=e(),l=[],r=Be(s)?.url||s;if(r){let o=new URL(r),m=new URLSearchParams;m.set("page",n.toString()),m.set("limit",i.toString()),u?.length&&m.set("tags",u.join(" ")),o.search=m.toString();let f=await fetch(o);if(f.ok){let p=await f.json();for(let V of(Array.isArray(p)?p:p.post)||[])V.id!==void 0&&V.file_url!==void 0&&(V.preview_url===void 0&&V.preview_file_url===void 0||l.push(Pe(s,V)))}}t(l)}),t}function Pe(e,t){let n={id:t.id,fileUrl:t.file_url,previewUrl:t.preview_url||t.preview_file_url,artist:t.tag_string_artist||void 0,tags:[],source:e},i=t.tags||t.tag_string;return i&&n.tags.push(...i.split(" ").filter(s=>s)),n}function oe(e){let t=document.title;b(()=>document.title=e()),$(()=>document.title=t)}var ue=()=>{let e=location.hash;return e.startsWith("#")&&(e=e.slice(1)),e},le=()=>{let e=new URLSearchParams(ue());return{url:e.has("url")?e.get("url"):ae()?.url,page:e.has("page")?~~e.get("page"):1,limit:e.has("limit")?~~e.get("limit"):40,search:e.has("search")?e.get("search"):"",tags:e.has("tags")?e.get("tags").split(",").filter(t=>t):[]}},A=v(()=>{let e=le(),t=g(e.url),n=g(e.limit),i=g(0),s=g(1/0),u=g(e.search),l=g(),r=g(e.tags),o=g(e.page),m=g(),f=se(()=>({url:t(),limit:n(),page:o(),tags:r()})),p=()=>{let d=[];for(let T of f())for(let M of T.tags)d.includes(M)===!1&&d.push(M);return d.sort((T,M)=>T<M?-1:T>M?1:0)},V=d=>!I(d)&&r([...r(),d]),N=d=>r(r().filter(T=>T!==d)),Te=d=>I(d)?N(d):V(d),I=d=>r().includes(d),pe=()=>(t(),r(),void 0),W=d=>{let T=le();t(T.url),o(T.page),n(T.limit),u(T.search),r(T.tags)};return b(E(u,d=>{if(d!==u()){let T=u().split(" ").filter(M=>M);for(let M of T)V(M);o(1)}return u()}),e.search),oe(()=>{let d=`\u30D6\u30E9\u30A6\u30B6\uFF1A${o()}`;return r().length&&(d+=` \u300C${r().join("\u3001 ")}\u300D`),d}),b(E(f,()=>{s(f().length),i(0)})),b(E(pe,d=>{let T=`${t()}${r().join()}`;return d!==T&&o(1),T}),`${t()}${r().join()}`),b(d=>(d.set("page",o().toString()),d.set("limit",n().toString()),d.set("url",t()),u().length?d.set("search",u()):d.delete("search"),r().length?d.set("tags",r().join(",")):d.delete("tags"),removeEventListener("popstate",W),location.hash=d.toString(),addEventListener("popstate",W),d),new URLSearchParams(ue())),{highlighted:l,tags:r,posts:f,postTags:p,page:o,select:m,addTag:V,delTag:N,hasTag:I,toggleTag:Te,search:u,loaded:i,size:s,limit:n,url:t}});function de(){let e=localStorage.getItem("is:pervert")==="true",t="imapervert".split(""),n=g(e),i=0,s=({key:u})=>{if(i===t.length-1){localStorage.setItem("is:pervert","true"),n(!0);return}u!=null&&t[i]!=null&&u.toLowerCase()===t[i].toLowerCase()?i++:(i=0,n(!1))};return b(()=>{x(()=>removeEventListener("keyup",s)),!n()&&addEventListener("keyup",s)}),n}function ge(e,t){return new Promise(n=>{let i=document.createElement("input");i.type="file",i.accept=e,i.onchange=s=>{let u=s.currentTarget.files;if(u===null)return;let l=new FileReader;l.onload=()=>{n(l.result)},l[t](u[0])},i.click()})}function ce(e,t,n){let i=`${t};charset=utf-8,${encodeURIComponent(n)}`,s=document.createElement("a");s.href="data:"+i,s.download=e,s.click()}function y(e){let t=g(!1),n=g(!1);b(()=>t(e.show())),b(()=>{t()?e.onOpen?.():e.onClose?.()});let i=()=>n(!n()),s=()=>t(!1),u=()=>`${n()?"compress":"enlarge"} window`,l=()=>`icon ${n()?"compress":"enlarge"}`;a("div",r=>{r.show=t,r.class="window",r.fullscreen=n,r.style={width:e.width,height:e.height},a("div",o=>{o.class="window-title",a("h3",{title:e.title,textContent:e.title}),a("div",m=>{m.class="window-title-children",e.titleChildren?.(),a("button",{type:"button",class:l,title:u,onClick:i}),a("button",{class:"icon close",type:"button",title:"close window",onClick:s})})}),a("div",o=>{o.class="window-content",a("div",m=>{m.class="window-content-wrapper",e.children?.()})})})}function be(e){y({title:()=>"source editor",show:e,titleChildren(){a("button",{class:"icon download-json",title:"download sources",onClick(){ce(`sources-${Date.now()}.json`,"application/json",JSON.stringify(L(),null,2))}})},children(){for(let t of L())Ie(t);Re()}})}function Re(){let e=g(""),t=g("");a("div",n=>{n.class="flex justify-content-space-betwee flex-gap-10",a("div",i=>{i.class="flex align-items-baseline width-100",a("label",{textContent:"name:"}),a("input",{class:"flex-1",name:"name",value:e,onInput(s){e(s.currentTarget.value)},placeholder:"*Booru"})}),a("div",i=>{i.class="flex align-items-baseline width-100",a("label",{textContent:"url:"}),a("input",{class:"flex-1",name:"url",value:t,onInput:s=>t(s.currentTarget.value),placeholder:"https://..."})}),a("div",i=>{i.class="flex",a("button",s=>{s.class="icon plus",s.title="add source",s.disabled=()=>!e()||!t(),s.onClick=()=>{!e()||!t()||(L(L().concat({name:e(),url:t()})),t(""),e(""))}}),a("button",{class:"icon import",title:"import source",async onClick(s){let u=await ge(".json","readAsText"),l=JSON.parse(u),r=[];if(Array.isArray(l))for(let o of l)o.name&&o.url&&r.push(o);L(L().concat(r))}})})})}function Ie(e){a("div",t=>{t.class="flex justify-content-space-between flex-gap-10",a("div",n=>{n.class="flex align-items-baseline width-100",a("label",{textContent:"name:"}),a("input",{class:"flex-1",name:"name",value:e.name,placeholder:"*Booru",onInput(i){e.name=i.currentTarget.value}})}),a("div",n=>{n.class="flex align-items-baseline width-100",a("label",{textContent:"url:"}),a("input",{class:"flex-1",value:e.url,placeholder:"https://...",onInput(i){e.url=i.currentTarget.value}})}),a("div",n=>{n.class="flex",a("button",{class:"icon check",title:"save source",onClick(){let i={url:e.url,name:e.name};L(L().filter(s=>s!==e).concat(i))}}),a("button",{class:"icon delete",title:"delete source",onClick(){L(L().filter(i=>i!==e))}})})})}var P=new Map;function me(e,t){let n=g(e);return b(E(t,async()=>{if(t()===!1)return n(e);if(P.has(e))return n(P.get(e));let i=await fetch(`https://danbooru.donmai.us/wiki_pages/${e}.json`);i.status===200?P.set(e,(await i.json()).body):P.set(e,e)})),n}function S(e,t){let{toggleTag:n,tags:i,highlighted:s}=A,u=g(!1),l=me(e,u);a("div",{class:"tag",title:l,textContent:e,artist:t?.artist===e,onClick:()=>n(e),onMouseOver:()=>u(!0),onMouseOut:()=>u(!1),state(){return i().includes(e)?"active":s()?.includes(e)?"highlight":"inactive"}})}function j(){let{postTags:e,tags:t,page:n,search:i,url:s}=A,u=g(!1),l=g(!1),r=de();a("nav",()=>{be(l),a("div",o=>{o.class="nav-top",a("div",m=>{m.class="flex align-items-center",r()&&a("button",f=>{f.title="choose image source",f.name="source",f.type="button",f.class="icon source z-index-1",a("div",p=>{p.class="sources",a("div",{title:"open source editor",textContent:"source editor",onClick:()=>l(!l())});for(let V of re())a("div",{active:()=>V.url===s(),textContent:V.name,onClick:()=>s(V.url)})})}),a("button",{class:"icon tags",onClick:()=>u(!u())}),a("input",f=>{f.class="flex-1",f.name="search",f.placeholder="search...",f.value=i,f.type="text";let p;f.onKeyUp=V=>{let N=V.currentTarget.value;clearTimeout(p),p=setTimeout(()=>i(N),1e3)}}),a("button",{title:"browse source",name:"sourcecode",type:"button",class:"icon sourcecode",onClick(){open("https://github.com/mini-jail/burauza","_blank")}})}),a("div",m=>{m.class="nav-paging",a("button",{class:"previous",textContent:()=>String(n()-1),disabled:()=>n()<=1,onClick:()=>n(n()-1)}),a("button",{class:"current",disabled:!0,textContent:()=>String(n())}),a("button",{class:"next",textContent:()=>String(n()+1),onClick:()=>n(n()+1)})})}),a("div",o=>{o.class="tag-list overflow-auto flex-1",o.show=u;let m=t(),f=e().filter(p=>!m.includes(p));for(let p of m)S(p);for(let p of f)S(p)})})}var k=g(new Set);function fe(){let e;B(document.body,()=>{a("div",t=>{t.class="loading-wrapper";for(let n of k())a("div",{class:"loading",textContent:n.text,loading:()=>{let i=n.on();return clearTimeout(e),n.on()&&(k().delete(n),e=setTimeout(()=>k(k()),2e3)),i}})})})}function R(e){queueMicrotask(()=>k(k().add(e)))}var Oe=["jpg","jpeg","bmp","png","gif"],De=e=>e.split(".").at(-1),Fe=e=>{let t=De(e);return t===void 0?!1:Oe.includes(t)};function U(){let{select:e,posts:t}=A,n=g(!1);x(()=>n(!1));let i=l=>{l.key==="ArrowRight"?u():l.key==="ArrowLeft"&&s()},s=()=>{let l=t().indexOf(e()),r=l-1===-1?t().length-1:l-1;e(t()[r])},u=()=>{let l=t().indexOf(e()),r=l+1===t().length?0:l+1;e(t()[r])};y({title:()=>String(e()?.fileUrl),show:n,width:"100%",onOpen:()=>addEventListener("keyup",i),onClose:()=>removeEventListener("keyup",i),titleChildren(){a("button",{class:"icon left",onClick:s}),a("button",{class:"icon right",onClick:u}),a("button",{class:"icon curly-arrow",title:"open file in new tab",onClick:()=>open(e().fileUrl,"_blank")})},children(){a("div",l=>{l.class="preview";let r=e();r!==void 0&&(R({on:n,text:()=>`loading "${r.id}"`}),a("img",{class:"preview-img",src:Fe(r.fileUrl)?r.fileUrl:r.previewUrl,alt:r.fileUrl,onLoad:()=>n(!0),onError:o=>{o.currentTarget.src===r.fileUrl&&(o.currentTarget.src=r.previewUrl)}}),a("div",o=>{o.class="tag-list";for(let m of r.tags)S(m,r)}))})}})}function z(){let{posts:e,highlighted:t,select:n,loaded:i,size:s}=A;a("main",u=>{let l=ne();u.ready=()=>s()<=i(),R({on:()=>s()<=i(),text:()=>`loading posts ${i()}/${s()}`}),_(()=>l.scrollTo({top:0,behavior:"smooth"}));for(let r of e())a("article",()=>{a("img",{src:r.previewUrl,alt:r.previewUrl,onClick:()=>n(r),onLoad:()=>i(i()+1),onError:()=>i(i()+1),onMouseOver:()=>t(r.tags),onMouseOut:()=>t(void 0)})})})}fe();B(document.body,()=>{j(),z(),U()});
//# sourceMappingURL=app.js.map
