/* Aizen Interaction Runtime v6
 * Central UI interaction layer. Rebinds dynamic controls and adds a safe
 * presentation layer without relying on stale generated onclick handlers.
 */
(function(){
  "use strict";

  const MODE_KEY="aizen-ai-mode";
  const MODES=Object.freeze([
    ["assistant","عادي"],["plan","تخطيط"],["review","مراجعة"],["fix","إصلاح"],
    ["explain","شرح"],["optimize","تحسين"],["security","أمان"],["test","اختبار"]
  ]);
  const THEMES=Object.freeze(["black","blue","white","purple","green"]);
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

  function injectThemeLayer(){
    if($("aizen-v6-theme-layer")) return;
    const style=document.createElement("style");
    style.id="aizen-v6-theme-layer";
    style.textContent=`
      body{--aizen-accent:#6d5dfc;--aizen-bg:#0b0d12;--aizen-surface:#101218;--aizen-card:#15181f;--aizen-border:#30343e;--aizen-assistant:#15181f;--aizen-user:#28224d;--aizen-text:#f4f5f7;--aizen-muted:#858b97;background:var(--aizen-bg)!important;color:var(--aizen-text)!important}
      body.theme-blue{--aizen-accent:#2f80ff;--aizen-bg:#07111f;--aizen-surface:#0b1627;--aizen-card:#102038;--aizen-border:#234c7c;--aizen-assistant:#102038;--aizen-user:#123d78}
      body.theme-white{--aizen-accent:#4b5563;--aizen-bg:#eef1f5;--aizen-surface:#ffffff;--aizen-card:#ffffff;--aizen-border:#cfd5df;--aizen-assistant:#ffffff;--aizen-user:#e7ebf2;--aizen-text:#111827;--aizen-muted:#596273}
      body.theme-purple{--aizen-accent:#8b5cf6;--aizen-bg:#100b18;--aizen-surface:#171022;--aizen-card:#21152f;--aizen-border:#4e3570;--aizen-assistant:#21152f;--aizen-user:#35205f}
      body.theme-green{--aizen-accent:#22c55e;--aizen-bg:#07140d;--aizen-surface:#0c1e14;--aizen-card:#112a1b;--aizen-border:#285d3c;--aizen-assistant:#112a1b;--aizen-user:#123f2a}
      body.theme-white .header,body.theme-white .sidebar{background:var(--aizen-surface)!important;color:var(--aizen-text)!important}
      .header,.sidebar,.composer,.modal-box,.auth-box,.profile-card,.project-item,.conversation-actions,.account-menu,.settings-section{background:var(--aizen-surface)!important;border-color:var(--aizen-border)!important}
      .messages,.chat-area{background:var(--aizen-bg)!important}
      .message-content{background:var(--aizen-assistant)!important;border-color:var(--aizen-border)!important;color:var(--aizen-text)!important}
      .message.user .message-content{background:var(--aizen-user)!important;border-color:var(--aizen-border)!important;color:var(--aizen-text)!important}
      .composer textarea,.auth-input,.search-box input{color:var(--aizen-text)!important}
      .composer-button,.build-button,.new-chat-button,.send-button,.auth-primary{border-color:var(--aizen-accent)!important}
      .new-chat-button,.send-button,.auth-primary{background:var(--aizen-accent)!important}
      .build-button{background:color-mix(in srgb,var(--aizen-accent) 25%,var(--aizen-surface))!important}
      .build-type-card:hover,.theme-choice:hover,.sidebar-tab.active{border-color:var(--aizen-accent)!important}
      .aizen-code{position:relative;margin:10px 0;padding:14px 12px;background:#080a0f!important;color:#e8edf5;border:1px solid #303846;border-radius:11px;overflow:auto;direction:ltr;text-align:left;white-space:pre;line-height:1.5;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:12px}
      .aizen-code-wrap{position:relative}.aizen-code-copy{position:absolute;top:7px;right:7px;border:1px solid #3a4150;background:#151a23;color:#fff;border-radius:7px;padding:5px 8px;font-size:10px;z-index:2}.aizen-code-copy:hover{background:#252c38}
      .aizen-build-status{display:inline-flex;align-items:center;gap:7px;color:var(--aizen-accent);font-weight:700}
      .aizen-build-status::before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor}
    `;
    document.head.appendChild(style);
  }

  function applyTheme(theme){
    const safe=THEMES.includes(theme)?theme:"black";
    document.body.classList.remove(...THEMES.map(t=>"theme-"+t));
    document.body.classList.add("theme-"+safe);
    localStorage.setItem("aizen-chat-theme",safe);
  }

  function patchThemeSetter(){
    if(typeof window.setChatTheme!=="function" || window.setChatTheme.__aizenV6)return;
    const original=window.setChatTheme;
    const wrapped=function(theme){
      const result=original(theme);
      applyTheme(localStorage.getItem("aizen-chat-theme")||theme||"black");
      return result;
    };
    wrapped.__aizenV6=true;
    window.setChatTheme=wrapped;
  }

  function enhanceCodeRendering(){
    if(typeof window.messageHTML!=="function" || window.messageHTML.__aizenV6)return;
    const original=window.messageHTML;
    const wrapped=function(message){
      if(message?.role!=="assistant") return original(message);
      const content=String(message.content||"");
      const formatted=typeof window.formatAizenResponse==="function"?window.formatAizenResponse(content):escapeHtmlLocal(content).replace(/\n/g,"<br>");
      return `<div class="message assistant"><div class="message-avatar"><div class="ai-avatar-small brand-ai-small" aria-label="Aizen AI">AI</div></div><div class="message-content">${formatted}</div></div>`;
    };
    wrapped.__aizenV6=true;
    window.messageHTML=wrapped;
  }

  function escapeHtmlLocal(value){
    return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }

  function addCopyButtons(){
    document.querySelectorAll(".message-content pre.aizen-code").forEach(pre=>{
      if(pre.dataset.copyReady==="1")return;
      pre.dataset.copyReady="1";
      const wrap=document.createElement("div");
      wrap.className="aizen-code-wrap";
      pre.parentNode.insertBefore(wrap,pre);
      wrap.appendChild(pre);
      const button=document.createElement("button");
      button.type="button";button.className="aizen-code-copy";button.textContent="نسخ";
      button.addEventListener("click",async()=>{
        try{await navigator.clipboard.writeText(pre.textContent||"");button.textContent="تم النسخ ✓";setTimeout(()=>button.textContent="نسخ",1200)}catch{toast("تعذر نسخ الكود.")}
      });
      wrap.appendChild(button);
    });
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
    try{const result=action(...args);return result?.catch?result.catch(e=>{console.error(e);toast("تعذر تنفيذ العملية حالياً.");}):result}
    catch(e){console.error(e);toast("تعذر تنفيذ العملية حالياً.");}
  }

  function detectBuildIntent(text){
    const value=String(text||"").trim().toLowerCase();
    if(!value)return false;
    return /(طور|طوّر|انشئ|أنشئ|ابني|ابنِ|بناء|build|develop|create|make).*(بوت|bot|موقع|website|تطبيق|app|ديسكورد|discord|تلغرام|telegram|لعبة|game)/i.test(value)
      || /(بوت|bot).*(ديسكورد|discord|تلغرام|telegram)/i.test(value);
  }

  function routeBuildRequest(text){
    if(!detectBuildIntent(text))return false;
    const open=fn("openBuildTypeModal");
    if(!open)return false;
    open();
    window.__aizenPendingBuildDescription=String(text||"").trim();
    return true;
  }

  function openModePicker(){
    let modal=$("aizenFreshModeModal");
    if(modal)return;
    modal=document.createElement("div");modal.id="aizenFreshModeModal";
    modal.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.72);display:flex;align-items:center;justify-content:center;padding:18px;z-index:10000";
    const box=document.createElement("div");box.style.cssText="width:min(440px,100%);background:var(--aizen-surface,#15181f);border:1px solid var(--aizen-border,#30343e);border-radius:16px;padding:16px;color:var(--aizen-text,#fff)";
    box.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><b>وضع Aizen AI</b><button type="button" data-aizen-mode-close style="border:0;background:transparent;color:#aaa;font-size:22px">×</button></div><div data-aizen-mode-grid style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>';
    modal.appendChild(box);document.body.appendChild(modal);
    box.querySelector("[data-aizen-mode-grid]").innerHTML=MODES.map(([v,label])=>`<button type="button" data-aizen-mode="${v}" style="padding:11px;border:1px solid var(--aizen-border,#30343e);border-radius:10px;background:var(--aizen-card,#1b1e26);color:var(--aizen-text,#fff);cursor:pointer">${label}</button>`).join("");
    modal.addEventListener("click",event=>{if(event.target===modal||event.target.closest("[data-aizen-mode-close]")){modal.remove();return}const choice=event.target.closest("[data-aizen-mode]");if(choice){setMode(choice.dataset.aizenMode);modal.remove()}});
  }

  function send(){
    const input=$("messageInput");
    if(!input)return call("sendMessage");
    const text=String(input.value||"").trim();
    if(!text)return call("sendMessage");
    if(routeBuildRequest(text))return;
    const selected=mode();
    if(selected!=="assistant"&&!/^\/(plan|review|fix|explain|optimize|security|test)\b/i.test(text))input.value="/"+selected+" "+input.value;
    return call("sendMessage");
  }

  function insertNewline(){
    const input=$("messageInput");if(!input)return;
    const start=input.selectionStart??input.value.length,end=input.selectionEnd??start;
    input.value=input.value.slice(0,start)+"\n"+input.value.slice(end);input.selectionStart=input.selectionEnd=start+1;input.dispatchEvent(new Event("input",{bubbles:true}));input.focus();
  }

  const ACTIONS=Object.freeze({
    "toggle-sidebar":toggleSidebar,"open-auth":()=>call("openAuth"),"toggle-account":toggleAccount,"new-chat":()=>call("newChat"),
    "tab-chats":()=>call("showSidebarTab","chats"),"tab-projects":()=>call("showSidebarTab","projects"),"attach":()=>call("triggerFileUpload"),
    "agent":()=>call("openAgentModal"),"ai-mode":openModePicker,"build":()=>call("openBuildTypeModal"),"stop":()=>call("stopGeneration"),"send":send,"newline":insertNewline
  });

  function bind(){
    document.querySelectorAll("[data-aizen-action]").forEach(element=>{
      if(element.dataset.aizenRuntimeBound==="1")return;
      const action=ACTIONS[element.dataset.aizenAction];if(typeof action!=="function")return;
      element.dataset.aizenRuntimeBound="1";
      element.addEventListener("click",event=>{if(element.disabled)return;event.preventDefault();event.stopImmediatePropagation();try{Promise.resolve(action()).catch(error=>{console.error("AIZEN UI ACTION",error);toast("تعذر تنفيذ الزر حالياً.")})}catch(error){console.error("AIZEN UI ACTION",error);toast("تعذر تنفيذ الزر حالياً.")}},true);
    });
  }

  function patchBuildDescriptionPrefill(){
    if(typeof window.confirmBuildType!=="function"||window.confirmBuildType.__aizenV6)return;
    const original=window.confirmBuildType;
    const wrapped=function(type){
      const result=original(type);
      const pending=String(window.__aizenPendingBuildDescription||"").trim();
      if(pending){
        const input=$("buildDescriptionInput");
        if(input&&!input.value)input.value=pending;
        window.__aizenPendingBuildDescription="";
      }
      return result;
    };
    wrapped.__aizenV6=true;window.confirmBuildType=wrapped;
  }

  function start(){
    injectThemeLayer();
    applyTheme(localStorage.getItem("aizen-chat-theme")||"black");
    patchThemeSetter();
    enhanceCodeRendering();
    patchBuildDescriptionPrefill();
    setMode(mode());
    bind();addCopyButtons();
    const observer=new MutationObserver(()=>{bind();patchThemeSetter();enhanceCodeRendering();patchBuildDescriptionPrefill();addCopyButtons()});
    observer.observe(document.body,{subtree:true,childList:true});
    window.aizenRebindControls=bind;
    window.aizenInteractionRuntime="v6";
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
})();