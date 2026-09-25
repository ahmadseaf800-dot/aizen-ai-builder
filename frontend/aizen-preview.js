/* Aizen Live Preview: WebContainers first, safe static iframe fallback. */
(function(){
  "use strict";
  const state={container:null,iframe:null,panel:null};
  const getToken=async()=>{
    const candidates=[window.supabase,window.sb,window.AIZEN_SUPABASE];
    for(const client of candidates){
      try{const s=await client?.auth?.getSession?.();const token=s?.data?.session?.access_token;if(token)return token;}catch{}
    }
    return null;
  };
  const getProjectId=()=>window.currentProjectId||localStorage.getItem("aizen-current-project-id")||localStorage.getItem("currentProjectId")||document.querySelector("[data-project-id]")?.dataset?.projectId||"";
  const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'\"':"&quot;"}[c]));
  function ensurePanel(){if(state.panel)return state.panel;const p=document.createElement("div");p.id="aizenLivePreview";p.style.cssText="position:fixed;inset:5vh 4vw 5vh 4vw;background:#0b0d12;border:1px solid #343945;border-radius:18px;z-index:20000;display:none;box-shadow:0 25px 80px #000b;overflow:hidden";p.innerHTML='<div style="height:52px;display:flex;align-items:center;gap:10px;padding:0 12px;border-bottom:1px solid #292d36;color:#fff"><b>⚡ Live Preview</b><span data-preview-status style="font-size:12px;color:#9da3af">جاهز</span><button data-preview-reload type="button" style="margin-inline-start:auto">↻</button><button data-preview-close type="button">×</button></div><iframe title="Aizen Live Preview" data-preview-frame style="width:100%;height:calc(100% - 52px);border:0;background:#fff"></iframe>';document.body.appendChild(p);p.querySelector("[data-preview-close]").onclick=()=>p.style.display="none";p.querySelector("[data-preview-reload]").onclick=()=>window.aizenLivePreview?.();state.panel=p;state.iframe=p.querySelector("[data-preview-frame]");return p;}
  function status(t){const n=state.panel?.querySelector("[data-preview-status]");if(n)n.textContent=t;}
  function show(){ensurePanel().style.display="block";}
  async function fetchFiles(){const id=getProjectId();if(!id)throw new Error("PROJECT_ID_REQUIRED");const token=await getToken();if(!token)throw new Error("LOGIN_REQUIRED");const r=await fetch("/api/workspace?projectId="+encodeURIComponent(id),{headers:{Authorization:"Bearer "+token}});const data=await r.json();if(!r.ok||!data.success)throw new Error(data.message||"تعذر تحميل ملفات المشروع");return data.files||[];}
  function staticFallback(files){const index=files.find(f=>f.path==="index.html")||files.find(f=>/\.html$/i.test(f.path));if(!index){status("لا يوجد index.html للمعاينة");return;}const blob=new Blob([index.content],{type:"text/html"});state.iframe.src=URL.createObjectURL(blob);status("معاينة HTML مباشرة");}
  async function runWebContainer(files){
    let mod;
    try{mod=await import("https://esm.sh/@webcontainer/api@1.6.1");}catch{throw new Error("WEBCONTAINER_UNAVAILABLE");}
    if(!window.crossOriginIsolated)throw new Error("COI_REQUIRED");
    const wc=state.container||(state.container=await mod.WebContainer.boot());
    const tree={};
    for(const f of files){const parts=String(f.path).split("/");let cur=tree;for(let i=0;i<parts.length-1;i++){cur[parts[i]]=cur[parts[i]]||{directory:{}};cur=cur[parts[i]].directory;}cur[parts.at(-1)]={file:{contents:String(f.content||"")}};}
    await wc.mount(tree);status("تشغيل المشروع…");
    let port=null;const ready=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error("PREVIEW_TIMEOUT")),90000);wc.on("server-ready",(p,url)=>{port=p;clearTimeout(timer);resolve(url);});wc.spawn("npm",["run","dev","--","--host","0.0.0.0"]).catch(reject);});
    if(!port||!ready)throw new Error("PREVIEW_SERVER_FAILED");state.iframe.src=ready;status("المشروع يعمل الآن");
  }
  async function preview(){show();status("تحميل ملفات المشروع…");try{const files=await fetchFiles();if(!files.length)throw new Error("PROJECT_EMPTY");try{await runWebContainer(files);}catch(e){console.warn("WebContainer fallback:",e.message);staticFallback(files);}}catch(e){status(e.message==="LOGIN_REQUIRED"?"سجّل الدخول أولاً":"تعذر تشغيل المعاينة: "+e.message);}}
  function addButton(){if(document.getElementById("aizenPreviewButton"))return;const b=document.createElement("button");b.id="aizenPreviewButton";b.type="button";b.textContent="⚡ معاينة";b.title="تشغيل المشروع داخل المتصفح";b.style.cssText="position:fixed;right:16px;bottom:78px;z-index:9000;border:1px solid #414654;background:#181b22;color:#fff;border-radius:12px;padding:10px 14px;cursor:pointer;box-shadow:0 8px 24px #0005";b.onclick=preview;document.body.appendChild(b);}
  window.aizenLivePreview=preview;window.aizenGetProjectId=getProjectId;function boot(){addButton();}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot,{once:true});else boot();
})();
