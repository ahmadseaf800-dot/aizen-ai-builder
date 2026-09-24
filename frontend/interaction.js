/* Aizen Fresh Interaction Layer
 * This file is the single owner of primary button interactions.
 * It does not depend on removed/legacy handler names.
 */
(function(){
  "use strict";

  const MODE_KEY="aizen-ai-mode";
  const MODES=[
    ["assistant","عادي"],
    ["plan","تخطيط"],
    ["review","مراجعة"],
    ["fix","إصلاح"],
    ["explain","شرح"],
    ["optimize","تحسين"],
    ["security","أمان"],
    ["test","اختبار"]
  ];

  function byId(id){return document.getElementById(id);}
  function call(name,...args){
    const fn=window[name];
    if(typeof fn!=="function") throw new Error("Aizen action unavailable: "+name);
    return fn(...args);
  }

  function toggleSidebar(){
    const sidebar=byId("sidebar");
    if(!sidebar)return;
    const mobile=window.matchMedia("(max-width:800px)").matches;
    sidebar.classList.toggle(mobile?"open":"aizen-collapsed");
    document.body.classList.toggle("aizen-sidebar-open",mobile&&sidebar.classList.contains("open"));
  }

  function closeSidebar(){
    const sidebar=byId("sidebar");
    if(!sidebar)return;
    sidebar.classList.remove("open","aizen-collapsed");
    document.body.classList.remove("aizen-sidebar-open");
  }

  function toggleAccount(){
    const menu=byId("accountMenu");
    if(!menu)return;
    const opening=menu.classList.contains("hidden");
    menu.classList.toggle("hidden",!opening);
    if(opening)closeSidebar();
  }

  function currentMode(){
    return localStorage.getItem(MODE_KEY)||"assistant";
  }

  function applyMode(mode){
    const value=MODES.some(item=>item[0]===mode)?mode:"assistant";
    localStorage.setItem(MODE_KEY,value);
    const button=byId("aiModeButton");
    if(button)button.textContent=value==="assistant"?"AI":"AI • "+(MODES.find(x=>x[0]===value)?.[1]||"");
  }

  function openModePicker(){
    let modal=byId("aizenFreshModeModal");
    if(!modal){
      modal=document.createElement("div");
      modal.id="aizenFreshModeModal";
      modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;padding:18px;z-index:10000";
      modal.innerHTML='<div style="width:min(430px,100%);background:#15181f;border:1px solid #30343e;border-radius:16px;padding:16px;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5)"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>وضع Aizen AI</b><button type="button" data-aizen-close-mode style="border:0;background:transparent;color:#aaa;font-size:22px">×</button></div><div data-aizen-mode-grid style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div></div>';
      document.body.appendChild(modal);
      modal.addEventListener("click",event=>{
        if(event.target===modal||event.target.closest("[data-aizen-close-mode]"))modal.remove();
        const item=event.target.closest("[data-aizen-mode]");
        if(item){
          applyMode(item.dataset.aizenMode);
          modal.remove();
        }
      });
    }
    const grid=modal.querySelector("[data-aizen-mode-grid]");
    grid.innerHTML=MODES.map(([value,label])=>'<button type="button" data-aizen-mode="'+value+'" style="padding:11px;border:1px solid #30343e;border-radius:10px;background:#1b1e26;color:#fff;cursor:pointer">'+label+"</button>").join("");
    modal.style.display="flex";
  }

  function send(){
    const input=byId("messageInput");
    const mode=currentMode();
    if(input&&input.value.trim()&&mode!=="assistant"){
      const original=input.value;
      input.value="/"+mode+" "+original;
      try{return call("sendMessage");}
      finally{input.value=original;}
    }
    return call("sendMessage");
  }

  const ACTIONS={
    "toggle-sidebar":toggleSidebar,
    "open-auth":()=>call("openAuth"),
    "toggle-account":toggleAccount,
    "new-chat":()=>call("newChat"),
    "tab-chats":()=>call("showSidebarTab","chats"),
    "tab-projects":()=>call("showSidebarTab","projects"),
    "attach":()=>call("triggerFileUpload"),
    "agent":()=>call("openAgentModal"),
    "ai-mode":openModePicker,
    "build":()=>call("openBuildTypeModal"),
    "stop":()=>call("stopGeneration"),
    "send":send
  };

  function bind(){
    document.querySelectorAll("button[data-aizen-action]").forEach(button=>{
      if(button.dataset.aizenFreshBound==="1")return;
      button.dataset.aizenFreshBound="1";
      button.addEventListener("click",async event=>{
        if(button.disabled)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        try{await ACTIONS[button.dataset.aizenAction]?.();}
        catch(error){
          console.error("AIZEN FRESH CONTROL ERROR",error);
          if(typeof window.showToast==="function")window.showToast("تعذر تنفيذ الزر حالياً.");
        }
      },{capture:true});
    });
  }

  function start(){
    applyMode(currentMode());
    bind();
    const observer=new MutationObserver(bind);
    observer.observe(document.body,{subtree:true,childList:true});
    window.aizenRebindControls=bind;
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();