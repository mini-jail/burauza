var Te=Symbol(),pe=new Set,E,b;function x(e){let t=_();b=t;try{return X(()=>{let n;return e.length&&(n=U.bind(void 0,t,!0)),e(n)})}catch(n){Q(n)}finally{b=t.parentNode}}function _(e,t){let n={value:e,parentNode:b,children:void 0,injections:void 0,cleanups:void 0,callback:t,sources:void 0,sourceSlots:void 0};return b&&(b.children===void 0?b.children=[n]:b.children.push(n)),n}function B(e){m(()=>j(e))}function $(e){C(()=>j(e))}function N(e,t){return n=>(e(),j(()=>t(n)))}function m(e,t){if(b){let n=_(t,e);E?E.add(n):queueMicrotask(()=>Y(n,!1))}else queueMicrotask(()=>e(t))}function K(e,t){return e?e.injections&&t in e.injections?e.injections[t]:K(e.parentNode,t):void 0}function Ve(e){return{value:e,nodes:void 0,nodeSlots:void 0}}function Le(e){if(b&&b.callback){let t=e.nodes?.length||0,n=b.sources?.length||0;b.sources===void 0?(b.sources=[e],b.sourceSlots=[t]):(b.sources.push(e),b.sourceSlots.push(t)),e.nodes===void 0?(e.nodes=[b],e.nodeSlots=[n]):(e.nodes.push(b),e.nodeSlots.push(n))}return e.value}function Me(e,t){typeof t=="function"&&(t=t(e.value)),e.value=t,e.nodes?.length&&X(()=>{for(let n of e.nodes)E.add(n)})}function He(e,t){return arguments.length===1?Le(e):Me(e,t)}function c(e){let t=Ve(e);return He.bind(void 0,t)}function Q(e){let t=K(b,Te);if(!t)return reportError(e);for(let n of t)n(e)}function C(e){b!==void 0&&(b.cleanups?b.cleanups.push(e):b.cleanups=[e])}function j(e){let t=b;b=void 0;let n=e();return b=t,n}function X(e){if(E)return e();E=pe;let t=e();return queueMicrotask(Ae),t}function Ae(){if(E!==void 0){for(let e of E)E.delete(e),Y(e,!1);E=void 0}}function Y(e,t){if(U(e,t),e.callback===void 0)return;let n=b;b=e;try{e.value=e.callback(e.value)}catch(i){Q(i)}finally{b=n}}function he(e){let t,n,i,r;for(;e.sources.length;)t=e.sources.pop(),n=e.sourceSlots.pop(),t.nodes?.length&&(i=t.nodes.pop(),r=t.nodeSlots.pop(),n<t.nodes.length&&(t.nodes[n]=i,t.nodeSlots[n]=r,i.sourceSlots[r]=n))}function ve(e,t){let n=e.callback!==void 0,i;for(;e.children.length;)i=e.children.pop(),U(i,t||n&&i.callback!==void 0)}function U(e,t){e.sources?.length&&he(e),e.children?.length&&ve(e,t),e.cleanups?.length&&Ee(e),e.injections=void 0,t&&Se(e)}function Ee(e){for(;e.cleanups?.length;)e.cleanups.pop()()}function Se(e){e.value=void 0,e.parentNode=void 0,e.children=void 0,e.cleanups=void 0,e.callback=void 0,e.sources=void 0,e.sourceSlots=void 0}var y,z,A;function P(){return A}function s(e,t){let n=document.createElement(e);t&&Ce(n,t),we(n)}function R(e,t){return x(n=>{let i=A;return A=e,t(),A=i,n})}function h(e){if(A===void 0)return e();let t=A.appendChild(new Text);m(n=>{let i=z=[];return e(),ke(t,n,i),z=void 0,i.length>0?i:void 0})}function V(e){return(...t)=>x(()=>e(...t))}function ke(e,t,n){let i=e.parentNode;if(t===void 0){for(let T of n)i.insertBefore(T,e);return}let r=t.length,l=n.length,o,a,u;e:for(a=0;a<l;a++){for(o=t[a],u=0;u<r;u++)if(t[u]!==void 0&&(t[u].nodeType===3&&n[a].nodeType===3?(t[u].data!==n[a].data&&(t[u].data=n[a].data),n[a]=t[u]):t[u].isEqualNode(n[a])&&(n[a]=t[u]),n[a]===t[u])){if(t[u]=void 0,a===u)continue e;break}i.insertBefore(n[a],o?.nextSibling||null)}for(;t.length;)t.pop()?.remove()}function J(e){return e.replace(/([A-Z])/g,t=>"-"+t[0]).toLowerCase()}function xe(e){return e.startsWith("on:")?e.slice(3):e.slice(2).toLowerCase()}function ye(e,t,n){for(let i in n){let r=n[i];typeof r=="function"?m(l=>{let o=r();return o!==l&&(e[t][i]=o||null),o}):e[t][i]=r||null}}function Ne(e,t,n){m(i=>{let r=n();return r!==i&&Z(e,t,r),r})}function Z(e,t,n){typeof n=="function"&&!t.startsWith("on")?Ne(e,t,n):typeof n=="object"?ye(e,t,n):t==="textContent"?e.firstChild?.nodeType===3?e.firstChild.data=String(n):e.prepend(String(n)):t in e?e[t]=n:t.startsWith("on")?e.addEventListener(xe(t),n):n!=null?e.setAttributeNS(null,J(t),String(n)):e.removeAttributeNS(null,J(t))}function we(e){A===void 0?z?.push(e):A?.appendChild(e)}function Ce(e,t){let n=A,i=y;if(A=e,y=t.length?{}:void 0,t(y),A=void 0,y)for(let r in y)Z(e,r,y[r]);A=n,y=i}var Ge=await Pe(),M=c(Be()),W=x(()=>{let e=()=>[...Ge,...M()];return m(t=>{let n=M();if(t===!0)return!1;localStorage.setItem("sources",JSON.stringify(n))},!0),e});function Be(){let e=localStorage.getItem("sources")||"[]";try{return JSON.parse(e)}catch{return[]}}async function Pe(){try{return await(await fetch("./sources.json")).json()}catch{return[]}}function ee(){return W()}function Re(e){return W().find(t=>t.url===e)}function te(){return W()[0]}function ne(e){let t=c([]);return m(async()=>{let{page:n=1,limit:i=40,url:r,tags:l}=e(),o=[],a=Re(r)?.url||r;if(a){let u=new URL(a),T=new URLSearchParams;T.set("page",n.toString()),T.set("limit",i.toString()),l?.length&&T.set("tags",l.join(" ")),u.search=T.toString();let L=await fetch(u);if(L.ok){let d=await L.json();for(let f of(Array.isArray(d)?d:d.post)||[])f.id!==void 0&&f.file_url!==void 0&&(f.preview_url===void 0&&f.preview_file_url===void 0||o.push(Ie(r,f)))}}t(o)}),t}function Ie(e,t){let n={id:t.id,fileUrl:t.file_url,previewUrl:t.preview_url||t.preview_file_url,artist:t.tag_string_artist||void 0,tags:[],source:e},i=t.tags||t.tag_string;return i&&n.tags.push(...i.split(" ").filter(r=>r)),n}function ie(e){let t=document.title;m(()=>document.title=e()),$(()=>document.title=t)}var ae=()=>{let e=location.hash;return e.startsWith("#")&&(e=e.slice(1)),e},re=()=>{let e=new URLSearchParams(ae());return{url:e.has("url")?e.get("url"):te()?.url,page:e.has("page")?~~e.get("page"):1,limit:e.has("limit")?~~e.get("limit"):40,search:e.has("search")?e.get("search"):"",tags:e.has("tags")?e.get("tags").split(",").filter(t=>t):[]}},S=x(()=>{let e=re(),t=c(e.url),n=c(e.limit),i=c(0),r=c(1/0),l=c(e.search),o=c([]),a=c(e.tags),u=c(e.page),T=c(),L=ne(()=>({url:t(),limit:n(),page:u(),tags:a()})),d=()=>{let g=[];for(let p of L())for(let v of p.tags)g.includes(v)===!1&&g.push(v);return g.sort((p,v)=>p<v?-1:p>v?1:0)},f=g=>!F(g)&&a([...a(),g]),H=g=>a(a().filter(p=>p!==g)),k=g=>F(g)?H(g):f(g),F=g=>a().includes(g),fe=()=>(t(),a(),void 0),q=g=>{let p=re();t(p.url),u(p.page),n(p.limit),l(p.search),a(p.tags)};return m(N(l,g=>{if(g!==l()){let p=l().split(" ").filter(v=>v);for(let v of p)f(v);u(1)}return l()}),e.search),ie(()=>{let g=`\u30D6\u30E9\u30A6\u30B6\uFF1A${u()}`;return a().length&&(g+=` \u300C${a().join("\u3001 ")}\u300D`),g}),m(N(L,()=>{r(L().length),i(0)})),m(N(fe,g=>{let p=`${t()}${a().join()}`;return g!==p&&u(1),p}),`${t()}${a().join()}`),m(g=>(g.set("page",u().toString()),g.set("limit",n().toString()),g.set("url",t()),l().length?g.set("search",l()):g.delete("search"),a().length?g.set("tags",a().join(",")):g.delete("tags"),removeEventListener("popstate",q),location.hash=g.toString(),addEventListener("popstate",q),g),new URLSearchParams(ae())),{highlighted:o,tags:a,posts:L,postTags:d,page:u,select:T,addTag:f,delTag:H,hasTag:F,toggleTag:k,search:l,loaded:i,size:r,limit:n,url:t}});function se(){let e=localStorage.getItem("is:pervert")==="true",t="imapervert".split(""),n=c(e),i=0,r=({key:l})=>{if(i===t.length-1){localStorage.setItem("is:pervert","true"),n(!0);return}l!=null&&t[i]!=null&&l.toLowerCase()===t[i].toLowerCase()?i++:(i=0,n(!1))};return m(()=>{C(()=>removeEventListener("keyup",r)),!n()&&addEventListener("keyup",r)}),n}function oe(e,t){return new Promise(n=>{let i=document.createElement("input");i.type="file",i.accept=e,i.onchange=r=>{let l=r.currentTarget.files;if(l===null)return;let o=new FileReader;o.onload=()=>{n(o.result)},o[t](l[0])},i.click()})}function le(e,t,n){let i=`${t};charset=utf-8,${encodeURIComponent(n)}`,r=document.createElement("a");r.href="data:"+i,r.download=e,r.click()}function Oe(e){let t=c(!1),n=c(!1);m(()=>t(e.show())),m(()=>{t()?e.onOpen?.():e.onClose?.()}),s("div",i=>{i.show=t,i.class="window",i.fullscreen=n,i.style={width:e.width,height:e.height},s("div",r=>{r.class="window-title",s("h3",l=>{l.textContent=e.title,l.title=e.title}),s("div",l=>{l.class="window-title-children",e.titleChildren&&h(e.titleChildren),s("button",o=>{o.class=()=>`icon ${n()?"compress":"enlarge"}`,o.title=()=>`${n()?"compress":"enlarge"} window`,o.onClick=()=>n(!n())}),s("button",o=>{o.class="icon close",o.title="close window",o.onClick=()=>t(!1)})})}),s("div",r=>{r.class="window-content",s("div",l=>{l.class="window-content-wrapper",h(e.children)})})})}var I=V(Oe);var ue=V(e=>{I({title:()=>"source editor",show:e,titleChildren(){s("button",t=>{t.class="icon download-json",t.title="download sources",t.onClick=()=>le(`sources-${Date.now()}.json`,"application/json",JSON.stringify(M(),null,2))})},children(){for(let t of M())Fe(t);De()}})}),De=V(()=>{let e=c(""),t=c("");s("div",n=>{n.class="flex justify-content-space-betwee flex-gap-10",s("div",i=>{i.class="flex align-items-baseline width-100",s("label",r=>r.textContent="name:"),s("input",r=>{r.class="flex-1",r.name="name",r.value=e,r.onInput=l=>e(l.currentTarget.value),r.placeholder="*Booru"})}),s("div",i=>{i.class="flex align-items-baseline width-100",s("label",r=>r.textContent="url:"),s("input",r=>{r.class="flex-1",r.name="url",r.value=t,r.onInput=l=>t(l.currentTarget.value),r.placeholder="https://..."})}),s("div",i=>{i.class="flex",s("button",r=>{r.class="icon plus",r.title="add source",r.disabled=()=>!e()||!t(),r.onClick=()=>{!e()||!t()||(M(M().concat({name:e(),url:t()})),t(""),e(""))}}),s("button",r=>{r.class="icon import",r.title="import source",r.onClick=async()=>{let l=await oe(".json","readAsText"),o=JSON.parse(l),a=[];if(Array.isArray(o))for(let u of o)u.name&&u.url&&a.push(u);M(M().concat(a))}})})})}),Fe=V(e=>{s("div",t=>{t.class="flex justify-content-space-between flex-gap-10",s("div",n=>{n.class="flex align-items-baseline width-100",s("label",i=>i.textContent="name:"),s("input",i=>{i.class="flex-1",i.name="name",i.value=e.name,i.placeholder="*Booru",i.onInput=r=>e.name=r.currentTarget.value})}),s("div",n=>{n.class="flex align-items-baseline width-100",s("label",i=>i.textContent="url:"),s("input",i=>{i.class="flex-1",i.value=e.url,i.placeholder="https://...",i.onInput=r=>e.url=r.currentTarget.value})}),s("div",n=>{n.class="flex",s("button",i=>{i.class="icon check",i.title="save source",i.onClick=()=>{let r={url:e.url,name:e.name};M(M().filter(l=>l!==e).concat(r))}}),s("button",i=>{i.class="icon delete",i.title="delete source",i.onClick=()=>{M(M().filter(r=>r!==e))}})})})});var O=new Map;function de(e,t){let n=c(e);return m(N(t,async()=>{if(t()===!1)return n(e);if(O.has(e))return n(O.get(e));let i=await fetch(`https://danbooru.donmai.us/wiki_pages/${e}.json`);i.status===200?O.set(e,(await i.json()).body):O.set(e,e)})),n}var je=V((e,t)=>{let{toggleTag:n,tags:i,highlighted:r}=S,l=c(!1),o=de(e,l);s("div",a=>{a.textContent=e,a.class="tag",a.title=o,t?.artist===e&&(a.artist=!0),a.onClick=()=>n(e),a.onMouseOver=()=>l(!0),a.onMouseOut=()=>l(!1),a.state=()=>{if(i().includes(e))return"active";if(r().includes(e))return"highlight"}})}),G=je;var Ue=V(()=>{let{postTags:e,tags:t,page:n,search:i,url:r}=S,l=c(!1),o=c(!1),a=se();s("nav",()=>{let u=P();ue(o),s("div",T=>{T.class="nav-top",s("div",L=>{L.class="flex align-items-center",h(()=>{a()!==!1&&s("button",d=>{d.title="choose image source",d.name="source",d.type="button",d.class="icon source z-index-1",s("div",f=>{f.class="sources",s("div",H=>{H.title="open source editor",H.textContent="source editor",H.onClick=()=>o(!o())});for(let H of ee())s("div",k=>{k.active=()=>H.url===r(),k.textContent=H.name,k.onClick=()=>r(H.url)})})})}),s("button",d=>{d.class="icon tags",d.onClick=()=>l(!l())}),s("input",d=>{d.class="flex-1",d.name="search",d.placeholder="search...",d.value=i,d.type="text";let f;d.onKeyUp=H=>{let k=H.currentTarget.value;clearTimeout(f),f=setTimeout(()=>i(k),1e3)}}),s("button",d=>{d.title="browse source",d.name="sourcecode",d.type="button",d.class="icon sourcecode",d.onClick=()=>{open("https://github.com/mini-jail/burauza","_blank")}})}),s("div",L=>{L.class="nav-paging",s("button",d=>{d.class="previous",d.textContent=()=>String(n()-1),d.disabled=()=>n()<=1,d.onClick=()=>n(n()-1)}),s("button",d=>{d.class="current",d.disabled=!0,d.textContent=()=>String(n())}),s("button",d=>{d.class="next",d.textContent=()=>String(n()+1),d.onClick=()=>n(n()+1)})})}),s("div",T=>{T.class="tag-list overflow-auto flex-1",T.show=l,h(()=>{let L=t(),d=e().filter(f=>!L.includes(f));B(()=>u.scrollTo({top:0,behavior:"smooth"}));for(let f of L)G(f);for(let f of d)G(f)})})})}),ge=Ue;var w=c(new Set);function ce(){let e;R(document.body,()=>{s("div",t=>{t.class="loading-wrapper",h(()=>{for(let n of w())s("div",i=>{i.class="loading",i.textContent=n.text,i.loading=()=>{let r=n.on();return clearTimeout(e),n.on()&&(w().delete(n),e=setTimeout(()=>w(w()),2e3)),r}})})})})}function D(e){queueMicrotask(()=>w(w().add(e)))}var ze=["jpg","jpeg","bmp","png","gif"],We=e=>e.split(".").at(-1),qe=e=>{let t=We(e);return t===void 0?!1:ze.includes(t)},_e=V(()=>{let{select:e,posts:t}=S,n=c(!1);m(()=>{C(()=>n(!1))});let i=o=>{o.key==="ArrowRight"?l():o.key==="ArrowLeft"&&r()},r=()=>{let o=t().indexOf(e()),a=o-1===-1?t().length-1:o-1;e(t()[a])},l=()=>{let o=t().indexOf(e()),a=o+1===t().length?0:o+1;e(t()[a])};I({title:()=>String(e()?.fileUrl),show:n,width:"100%",onOpen:()=>addEventListener("keyup",i),onClose:()=>removeEventListener("keyup",i),titleChildren(){s("button",o=>{o.class="icon left",o.onClick=r}),s("button",o=>{o.class="icon right",o.onClick=l}),s("button",o=>{o.class="icon curly-arrow",o.title="open file in new tab",o.onClick=()=>open(e().fileUrl,"_blank")})},children(){s("div",o=>{o.class="preview",h(()=>{let a=e();a!==void 0&&(D({on:n,text:()=>`loading "${a.id}"`}),s("img",u=>{u.class="preview-img",u.src=qe(a.fileUrl)?a.fileUrl:a.previewUrl,u.alt=a.fileUrl,u.onLoad=()=>n(!0),u.onError=T=>{T.currentTarget.src===a.fileUrl&&(T.currentTarget.src=a.previewUrl)}}),s("div",u=>{u.class="tag-list";for(let T of a.tags)G(T,a)}))})})}})}),be=_e;var $e=V(()=>{let{posts:e,highlighted:t,select:n,loaded:i,size:r}=S;s("main",l=>{let o=P();l.ready=()=>r()<=i(),h(()=>{D({on:()=>r()<=i(),text:()=>`loading posts ${i()}/${r()}`}),B(()=>o.scrollTo({top:0,behavior:"smooth"}));for(let a of e())s("article",()=>{s("img",u=>{u.src=a.previewUrl,u.alt=u.src,u.onClick=()=>n(a),u.onLoad=()=>i(i()+1),u.onError=u.onLoad,u.onMouseOver=()=>t(a.tags),u.onMouseOut=()=>t([])})})})})}),me=$e;var Ke=V(()=>{ge(),me(),be()});R(document.body,()=>{ce(),Ke()});
//# sourceMappingURL=app.js.map
