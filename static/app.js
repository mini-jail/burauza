var Me=Symbol(),He=new Set,A,c;function S(e){let t=q();c=t;try{return Y(()=>{let n;return e.length&&(n=F.bind(void 0,t,!0)),e(n)})}catch(n){Q(n)}finally{c=t.parentNode}}function q(e,t){let n={value:e,parentNode:c,children:void 0,injections:void 0,cleanups:void 0,callback:t,sources:void 0,sourceSlots:void 0};return c&&(c.children===void 0?c.children=[n]:c.children.push(n)),n}function $(e){b(()=>D(e))}function K(e){y(()=>D(e))}function h(e,t){return n=>(e(),D(()=>t(n)))}function b(e,t){if(c){let n=q(t,e);A?A.add(n):queueMicrotask(()=>J(n,!1))}else queueMicrotask(()=>e(t))}function X(e,t){return e?e.injections&&t in e.injections?e.injections[t]:X(e.parentNode,t):void 0}function Ae(e){return{value:e,nodes:void 0,nodeSlots:void 0}}function he(e){if(c&&c.callback){let t=e.nodes?.length||0,n=c.sources?.length||0;c.sources===void 0?(c.sources=[e],c.sourceSlots=[t]):(c.sources.push(e),c.sourceSlots.push(t)),e.nodes===void 0?(e.nodes=[c],e.nodeSlots=[n]):(e.nodes.push(c),e.nodeSlots.push(n))}return e.value}function ve(e,t){typeof t=="function"&&(t=t(e.value)),e.value=t,e.nodes?.length&&Y(()=>{for(let n of e.nodes)A.add(n)})}function Ee(e,t){return arguments.length===1?he(e):ve(e,t)}function g(e){let t=Ae(e);return Ee.bind(void 0,t)}function Q(e){let t=X(c,Me);if(!t)return reportError(e);for(let n of t)n(e)}function y(e){c!==void 0&&(c.cleanups?c.cleanups.push(e):c.cleanups=[e])}function D(e){let t=c;c=void 0;let n=e();return c=t,n}function Y(e){if(A)return e();A=He;let t=e();return queueMicrotask(Se),t}function Se(){if(A!==void 0){for(let e of A)A.delete(e),J(e,!1);A=void 0}}function J(e,t){if(F(e,t),e.callback===void 0)return;let n=c;c=e;try{e.value=e.callback(e.value)}catch(i){Q(i)}finally{c=n}}function ke(e){let t,n,i,s;for(;e.sources.length;)t=e.sources.pop(),n=e.sourceSlots.pop(),t.nodes?.length&&(i=t.nodes.pop(),s=t.nodeSlots.pop(),n<t.nodes.length&&(t.nodes[n]=i,t.nodeSlots[n]=s,i.sourceSlots[s]=n))}function xe(e,t){let n=e.callback!==void 0,i;for(;e.children.length;)i=e.children.pop(),F(i,t||n&&i.callback!==void 0)}function F(e,t){e.sources?.length&&ke(e),e.children?.length&&xe(e,t),e.cleanups?.length&&ye(e),e.injections=void 0,t&&Ne(e)}function ye(e){for(;e.cleanups?.length;)e.cleanups.pop()()}function Ne(e){e.value=void 0,e.parentNode=void 0,e.children=void 0,e.cleanups=void 0,e.callback=void 0,e.sources=void 0,e.sourceSlots=void 0}var v,G,B,C=new Set;function ie(){return B}function a(e,t){let n=document.createElement(e);t&&re(n,t),we(n)}function re(e,t){if(typeof t=="object")return ne(e,void 0,t);e.append(""),b(n=>{let i=G=[];if(v=t.length?Object.create(null):void 0,B=e,t(v),(n?.[1]?.length||i.length)&&Ce(e.firstChild,n?.[1],i),B=void 0,G=void 0,(n?.[0]||v)&&ne(e,n?.[0],v),v=void 0,v||i.length)return[v,i]})}function we(e){G?G.push(e):B?.appendChild(e)}function Ce(e,t,n){let i=e.parentNode;if(t===void 0){for(let m of n)i.insertBefore(m,e);return}let s=t.length,o=n.length,u,r,l;e:for(r=0;r<o;r++){for(u=t[r],l=0;l<s;l++)if(t[l]!==void 0&&(t[l].nodeType===3&&n[r].nodeType===3?(t[l].data!==n[r].data&&(t[l].data=n[r].data),n[r]=t[l]):t[l].isEqualNode(n[r])&&(n[r]=t[l]),n[r]===t[l])){if(t[l]=void 0,r===l)continue e;break}i.insertBefore(n[r],u?.nextSibling||null)}for(;t.length;)t.pop()?.remove()}function Z(e){return e.replace(/([A-Z])/g,t=>"-"+t[0]).toLowerCase()}function ee(e){return e.startsWith("on:")?e.slice(3):e.slice(2).toLowerCase()}function te(e,t,n){if(t==="text"||t==="textContent")e.firstChild?.nodeType===3?e.firstChild.data=String(n):e.prepend(String(n));else if(typeof n=="object")for(let i in n)typeof n[i]=="function"?b(s=>{let o=n[i]();return o!==s&&(e[t][i]=o||null),o}):e[t][i]=n[i]||null;else t in e?e[t]=n:n!==void 0?e.setAttributeNS(null,Z(t),String(n)):e.removeAttributeNS(null,Z(t))}function ne(e,t,n){C.clear(),t&&Object.keys(t).forEach(s=>C.add(s)),n&&Object.keys(n).forEach(s=>C.add(s));let i;for(let s of C){let o=n?.[s],u=t?.[s];o===void 0&&u===void 0||(s.startsWith("on")&&u!==o?(u&&e.removeEventListener(ee(s),t[s]),o&&e.addEventListener(ee(s),n[s])):typeof o=="function"?i===void 0?i=[s]:i.push(s):te(e,s,n?.[s]))}i&&b(s=>{for(let o of i){let u=n[o]();s[o]!==u&&(te(e,o,u),s[o]=u)}return s},{})}function P(e,t){return S(n=>(re(e,t),n))}var Ge=await Pe(),L=g(Be()),j=S(()=>{let e=()=>[...Ge,...L()];return b(t=>{let n=L();if(t===!0)return!1;localStorage.setItem("sources",JSON.stringify(n))},!0),e});function Be(){let e=localStorage.getItem("sources")||"[]";try{return JSON.parse(e)}catch{return[]}}async function Pe(){try{return await(await fetch("./sources.json")).json()}catch{return[]}}function ae(){return j()}function Re(e){return j().find(t=>t.url===e)}function se(){return j()[0]}var N=new URLSearchParams;function oe(e){let t=g([]);return b(async()=>{let{page:n=1,limit:i=40,url:s,tags:o}=e(),u=[],r=Re(s)?.url||s;if(r){let l=new URL(r);N.set("page",n.toString()),N.set("limit",i.toString()),N.delete("tags"),o?.length&&N.set("tags",o.join(" ")),l.search=N.toString();let m=await fetch(l);if(m.ok){let p=await m.json();for(let T of(Array.isArray(p)?p:p.post)||[])T.id!==void 0&&T.file_url!==void 0&&(T.preview_url===void 0&&T.preview_file_url===void 0||u.push(Ie(T)))}}t(u)}),t}function Ie(e){return{id:e.id,fileUrl:e.file_url,fileExtension:String(e.file_url.split(".").at(-1)),previewUrl:e.preview_url||e.preview_file_url,artist:e.tag_string_artist||void 0,tags:Oe(e),dimensions:De(e)}}function Oe(e){let t=[];return(e.tags||e.tag_string)&&t.push(...(e.tags||e.tag_string).split(" ")),t}function De(e){let t=e.image_width||e.width,n=e.image_height||e.height;return[t,n]}function le(e){let t=document.title;b(()=>document.title=e()),K(()=>document.title=t)}var de=()=>{let e=location.hash;return e.startsWith("#")&&(e=e.slice(1)),e},ue=()=>{let e=new URLSearchParams(de());return{url:e.has("url")?e.get("url"):se()?.url,page:e.has("page")?~~e.get("page"):1,limit:e.has("limit")?~~e.get("limit"):40,search:e.has("search")?e.get("search"):"",tags:e.has("tags")?e.get("tags").split(",").filter(t=>t):[]}},M=S(()=>{let e=ue(),t=g(e.url),n=g(e.limit),i=g(0),s=g(1/0),o=g(e.search),u=g(),r=g(e.tags),l=g(e.page),m=g(),p=oe(()=>({url:t(),limit:n(),page:l(),tags:r()})),T=()=>{let d=[];for(let f of p())for(let H of f.tags)d.includes(H)===!1&&d.push(H);return d.sort((f,H)=>f<H?-1:f>H?1:0)},V=d=>!O(d)&&r([...r(),d]),E=d=>r(r().filter(f=>f!==d)),Ve=d=>O(d)?E(d):V(d),O=d=>r().includes(d),Le=()=>(t(),r(),void 0),_=d=>{let f=ue();t(f.url),l(f.page),n(f.limit),o(f.search),r(f.tags)};return b(h(o,d=>{if(d!==o()){let f=o().split(" ").filter(H=>H);for(let H of f)V(H);l(1)}return o()}),e.search),le(()=>{let d=`\u30D6\u30E9\u30A6\u30B6\uFF1A${l()}`;return r().length&&(d+=` \u300C${r().join("\u3001 ")}\u300D`),d}),b(h(p,()=>{s(p().length),i(0)})),b(h(Le,d=>{let f=`${t()}${r().join()}`;return d!==f&&l(1),f}),`${t()}${r().join()}`),b(d=>(d.set("page",l().toString()),d.set("limit",n().toString()),d.set("url",t()),o().length?d.set("search",o()):d.delete("search"),r().length?d.set("tags",r().join(",")):d.delete("tags"),removeEventListener("popstate",_),location.hash=d.toString(),addEventListener("popstate",_),d),new URLSearchParams(de())),{highlighted:u,tags:r,posts:p,postTags:T,page:l,select:m,addTag:V,delTag:E,hasTag:O,toggleTag:Ve,search:o,loaded:i,size:s,limit:n,url:t}});function ge(){let e=localStorage.getItem("is:pervert")==="true",t="imapervert".split(""),n=g(e),i=0,s=({key:o})=>{if(i===t.length-1){localStorage.setItem("is:pervert","true"),n(!0);return}o!=null&&t[i]!=null&&o.toLowerCase()===t[i].toLowerCase()?i++:(i=0,n(!1))};return b(()=>{y(()=>removeEventListener("keyup",s)),!n()&&addEventListener("keyup",s)}),n}function ce(e,t){return new Promise(n=>{let i=document.createElement("input");i.type="file",i.accept=e,i.onchange=s=>{let o=s.currentTarget.files;if(o===null)return;let u=new FileReader;u.onload=()=>{n(u.result)},u[t](o[0])},i.click()})}function be(e,t,n){let i=`${t};charset=utf-8,${encodeURIComponent(n)}`,s=document.createElement("a");s.href="data:"+i,s.download=e,s.click()}function w(e){let t=g(!1),n=g(!1),i=()=>n(!n()),s=()=>t(!1),o=()=>`${n()?"compress":"enlarge"} window`,u=()=>`icon ${n()?"compress":"enlarge"}`;b(h(e.show,()=>t(e.show()))),b(h(t,()=>t()?e.onOpen?.():e.onClose?.())),a("div",r=>{r.show=t,r.class="window",r.fullscreen=n,r.style={width:e.width,height:e.height},a("div",l=>{l.class="window-title",a("h3",{title:e.title,textContent:e.title}),a("div",m=>{m.class="window-title-children",e.titleChildren?.(),a("button",{type:"button",class:u,title:o,onClick:i}),a("button",{class:"icon close",type:"button",title:"close window",onClick:s})})}),a("div",l=>{l.class="window-content",a("div",m=>{m.class="window-content-wrapper",e.children?.()})})})}function me(e){w({title:()=>"source editor",show:e,titleChildren(){a("button",{class:"icon download-json",title:"download sources",onClick(){be(`sources-${Date.now()}.json`,"application/json",JSON.stringify(L(),null,2))}})},children(){for(let t of L())je(t);Fe()}})}function Fe(){let e=g(""),t=g("");a("div",n=>{n.class="flex justify-content-space-betwee flex-gap-10",a("div",i=>{i.class="flex align-items-baseline width-100",a("label",{textContent:"name:"}),a("input",{class:"flex-1",name:"name",value:e,onInput(s){e(s.currentTarget.value)},placeholder:"*Booru"})}),a("div",i=>{i.class="flex align-items-baseline width-100",a("label",{textContent:"url:"}),a("input",{class:"flex-1",name:"url",value:t,onInput:s=>t(s.currentTarget.value),placeholder:"https://..."})}),a("div",i=>{i.class="flex",a("button",{class:"icon plus",title:"add source",disabled:()=>!e()||!t(),onClick(){!e()||!t()||(L(L().concat({name:e(),url:t()})),t(""),e(""))}}),a("button",{class:"icon import",title:"import source",async onClick(){let s=await ce(".json","readAsText"),o=JSON.parse(s),u=[];if(Array.isArray(o))for(let r of o)r.name&&r.url&&u.push(r);L(L().concat(u))}})})})}function je(e){a("div",t=>{t.class="flex justify-content-space-between flex-gap-10",a("div",n=>{n.class="flex align-items-baseline width-100",a("label",{textContent:"name:"}),a("input",{class:"flex-1",name:"name",value:e.name,placeholder:"*Booru",onInput(i){e.name=i.currentTarget.value}})}),a("div",n=>{n.class="flex align-items-baseline width-100",a("label",{textContent:"url:"}),a("input",{class:"flex-1",value:e.url,placeholder:"https://...",onInput(i){e.url=i.currentTarget.value}})}),a("div",n=>{n.class="flex",a("button",{class:"icon check",title:"save source",onClick(){let i={url:e.url,name:e.name};L(L().filter(s=>s!==e).concat(i))}}),a("button",{class:"icon delete",title:"delete source",onClick(){L(L().filter(i=>i!==e))}})})})}var R=new Map;function fe(e,t){let n=g(e);return b(h(t,async()=>{if(t()===!1)return n(e);if(R.has(e))return n(R.get(e));let i=await fetch(`https://danbooru.donmai.us/wiki_pages/${e}.json`);i.status===200?R.set(e,(await i.json()).body):R.set(e,e)})),n}addEventListener("click",e=>{let t=e.target?.dataset?.tag;t&&M.toggleTag(t)});function Ue(){return M.tags().includes(this)?"active":M.highlighted()?.includes(this)?"highlight":"inactive"}function k(e,t){let n=g(!1),i=fe(e,n);a("div",{class:"tag",title:i,dataTag:e,artist:t?.artist===e,onMouseOver:()=>n(!0),onMouseOut:()=>n(!1),state:Ue.bind(e)})}function U(){let{postTags:e,tags:t,page:n,search:i,url:s}=M,o=g(!1),u=g(!1),r=ge(),l;a("nav",()=>{me(u),a("div",m=>{m.class="nav-top",a("div",p=>{p.class="flex align-items-center",r()&&a("button",T=>{T.title="choose image source",T.name="source",T.type="button",T.class="icon source z-index-1",a("div",V=>{V.class="sources",a("div",{title:"open source editor",textContent:"source editor",onClick:()=>u(!u())});for(let E of ae())a("div",{active:()=>E.url===s(),textContent:E.name,onClick:()=>s(E.url)})})}),a("button",{class:"icon tags",title:"show tags",onClick:()=>o(!o())}),a("input",{class:"flex-1",name:"search",placeholder:"search...",value:i,type:"text",onKeyUp(T){let V=T.currentTarget.value;clearTimeout(l),l=setTimeout(()=>i(V),1e3)}}),a("button",{title:"browse source",name:"sourcecode",type:"button",class:"icon sourcecode",onClick(){open("https://github.com/mini-jail/burauza","_blank")}})}),a("div",p=>{p.class="nav-paging",a("button",{title:"show previous page",class:"previous",textContent:()=>String(n()-1),disabled:()=>n()<=1,onClick:()=>n(n()-1)}),a("button",{title:"current page",class:"current",disabled:!0,textContent:()=>String(n())}),a("button",{title:"show next page",class:"next",textContent:()=>String(n()+1),onClick:()=>n(n()+1)})})}),a("div",m=>{m.class="tag-list overflow-auto flex-1",m.show=o;let p=t(),T=e().filter(V=>!p.includes(V));for(let V of p)k(V);for(let V of T)k(V)})})}var x=g(new Set);function Te(){P(document.body,()=>{a("div",e=>{e.class="loading-wrapper";for(let t of x())a("div",{class:"loading",textContent:t.text,loading:()=>{let n=t.on();return t.on()&&(x().delete(t),x(x())),n}})})})}function I(e){queueMicrotask(()=>x(x().add(e)))}var ze=["jpg","jpeg","bmp","png","gif"],We=e=>e.split(".").at(-1),_e=e=>{let t=We(e);return t===void 0?!1:ze.includes(t)};function z(){let{select:e,posts:t}=M,n=g(!1);y(()=>n(!1));let i=u=>{u.key==="ArrowRight"?o():u.key==="ArrowLeft"&&s()},s=()=>{let u=t().indexOf(e()),r=u-1===-1?t().length-1:u-1;e(t()[r])},o=()=>{let u=t().indexOf(e()),r=u+1===t().length?0:u+1;e(t()[r])};w({title:()=>String(e()?.fileUrl),show:n,width:"100%",onOpen:()=>addEventListener("keyup",i),onClose:()=>removeEventListener("keyup",i),titleChildren(){a("button",{title:"show previous post",class:"icon left",onClick:s}),a("button",{title:"show next post",class:"icon right",onClick:o}),a("button",{title:"open file in new tab",class:"icon curly-arrow",onClick:()=>open(e().fileUrl,"_blank")})},children(){a("div",u=>{u.class="preview";let r=e();r!==void 0&&(I({on:n,text:()=>`loading "${r.id}"`}),a("img",{class:"preview-img",src:_e(r.fileUrl)?r.fileUrl:r.previewUrl,alt:r.fileUrl,onLoad:()=>n(!0),onError:l=>{l.currentTarget.src===r.fileUrl&&(l.currentTarget.src=r.previewUrl)}}),a("div",l=>{l.class="tag-list";for(let m of r.tags)k(m,r)}))})}})}function pe(){M.loaded(M.loaded()+1)}function qe(){M.highlighted(void 0)}function W(){let{posts:e,highlighted:t,select:n,loaded:i,size:s}=M;a("main",o=>{let u=ie();o.ready=()=>s()<=i(),I({on:()=>s()<=i(),text:()=>`loading posts ${i()}/${s()}`}),$(()=>u.scrollTo({top:0,behavior:"smooth"}));for(let r of e())a("article",l=>{l.dataId=r.id,l.dataDimensions=r.dimensions.join("x"),l.onClick=()=>n(r),l.onMouseUp=m=>{m.button===1&&open(r.fileUrl,"_blank")},l.onMouseOver=()=>t(r.tags),l.onMouseOut=qe,a("img",{src:r.previewUrl,alt:r.previewUrl,onLoad:pe,onError:pe})})})}Te();P(document.body,()=>{U(),W(),z()});
//# sourceMappingURL=app.js.map
