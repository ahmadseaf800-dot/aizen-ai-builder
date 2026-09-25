/* Aizen Interaction Runtime v5
 * One delegated event system for primary controls.
 * No duplicate per-button handlers, no dependency on stale generated onclick code.
 */
(function(){
  "use strict";

  const MODE_KEY="aizen-ai-mode";
  const MODES=Object.freeze([
    ["assistant","عادي"],["plan","تخطيط"],["review","مراجعة"],["fix","إصلاح"],
    ["explain","شرح"],["optimize","تحسين"],["security","أمان"],["test","اختبار"]
  ]);
  const $=id=>document.getElementById(id);
  const toast=msg=>{try{window.showToast?.(msg)}catch{}};
  const fn=name=>typeof window[name]==="function"?window[name]:null;

  function mode(){
    const value=localStorage.getItem(MODE_KEY)||"assistant";
    return MODES.some(x=>x[0]===value)?value:"assistant";
  }
  function setMode(value){
    const valueSafe=MODES.some(x=>x[0]===value)?value:"assistant";
    localStorage.setItem(MODE_KEY,valueSafe);
    const button=$("aiModeButton");
    if(button) button.textContent=valueSafe==="assistant"?"AI":"AI • "+MODES.find(x=>x[0]===valueSafe)[1];
  }

  function toggleSidebar(){
    const sidebar=$("sidebar");
    if(!sidebar)return;
    const mobile=window.matchMedia("(max-width:800px)").matches;
    sidebar.classList.toggle(mobile?"open":"aizen-collapsed");
    document.body.classList.toggle("aizen-sidebar-open",mobile&&sidebar.classList.contains("open"));
  }
  function toggleAccount(){
    const menu=$("accountMenu");
    if(!menu)return;
    menu.classList.toggle("hidden");
  }

  function call(name,...args){
    const action=fn(name);
    if(!action){toast("هذه الوظيفة غير متاحة حالياً.");return false;}
    try{const result=action(...args);return result?.catch?result.catch(e=>{console.error(e);toast("تعذر تنفيذ العملية حالياً.");}):result;}
    catch(e){console.error(e);toast("تعذر تنفيذ العملية حالياً.");}
  }

  function openModePicker(){
    let modal=$("aizenFreshModeModal");
    if(modal) return;
    modal=document.createElement("div");
    modal.id="aizenFreshModeModal";
    modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;z-index:10000";
    const box=document.createElement("div");
    box.style.cssText="width:min(440px,100%);background:#15181f;border:1px solid #30343e;border-radius:16px;padding:16px;color:#fff";
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>وضع Aizen AI</b><button type="button" data-aizen-mode-close style="border:0;background:transparent;color:#aaa;font-size:22px">×</button></div><div data-aizen-mode-grid style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>';
    modal.appendChild(box);document.body.appendChild(modal);
    const grid=box.querySelector("[data-aizen-mode-grid]");
    grid.innerHTML=MODES.map(([v,label])=>`<button type="button" data-aizen-mode="${v}" style="padding:11px;border:1px solid #30343e;border-radius:10px;background:#1b1e26;color:#fff;cursor:pointer">${label}</button>`).join("");
    modal.addEventListener("click",event=>{
      if(event.target===modal||event.target.closest("[data-aizen-mode-close]")){modal.remove();return;}
      const choice=event.target.closest("[data-aizen-mode]");
      if(choice){setMode(choice.dataset.aizenMode);modal.remove();}
    });
  }

  function send(){
    const input=$("messageInput");
    if(!input)return call("sendMessage");
    const text=String(input.value||"").trim();
    if(!text)return call("sendMessage");
    const selected=mode();
    if(selected!=="assistant" && !/^\/(plan|review|fix|explain|optimize|security|test)\b/i.test(text)){
      input.value="/"+selected+" "+input.value;
    }
    return call("sendMessage");
  }

  function insertNewline(){
    const input=$("messageInput");if(!input)return;
    const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
    input.value=input.value.slice(0,start)+"\n"+input.value.slice(end);
    input.selectionStart=input.selectionEnd=start+1;
    input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();
  }

  const ACTIONS=Object.freeze({
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
    "send":send,
    "newline":insertNewline
  });

  function bind(){
    document.querySelectorAll("[data-aizen-action]").forEach(element=>{
      if(element.dataset.aizenRuntimeBound==="1")return;
      const action=ACTIONS[element.dataset.aizenAction];
      if(typeof action!=="function")return;
      element.dataset.aizenRuntimeBound="1";
      element.addEventListener("click",event=>{
        if(element.disabled)return;
        event.preventDefault();
        event.stopImmediatePropagation();
        try{Promise.resolve(action()).catch(error=>{console.error("AIZEN UI ACTION",error);toast("تعذر تنفيذ الزر حالياً.");});}
        catch(error){console.error("AIZEN UI ACTION",error);toast("تعذر تنفيذ الزر حالياً.");}
      },true);
    });
  }

  function start(){
    setMode(mode());
    bind();
    const observer=new MutationObserver(()=>bind());
    observer.observe(document.body,{subtree:true,childList:true});
    window.aizenRebindControls=bind;
    window.aizenInteractionRuntime="v5";
  }

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});
  else start();
})();
