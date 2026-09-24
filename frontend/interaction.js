/* Aizen Independent Interaction Layer v9
 * Single authoritative control layer.
 * Uses capture + stopImmediatePropagation so legacy/inline handlers cannot
 * fire the same action a second time.
 */
(function(){
  "use strict";

  const ACTIONS=Object.freeze({
    "toggle-sidebar":()=>window.aizenToggleSidebarFresh?.(),
    "open-auth":()=>window.openAuth?.(),
    "toggle-account":()=>window.aizenToggleAccountFresh?.(),
    "new-chat":()=>window.newChat?.(),
    "tab-chats":()=>window.showSidebarTab?.("chats"),
    "tab-projects":()=>window.showSidebarTab?.("projects"),
    "attach":()=>window.triggerFileUpload?.(),
    "agent":()=>window.openAgentModal?.(),
    "ai-mode":()=>window.openAIModeModal?.(),
    "build":()=>window.openBuildTypeModal?.(),
    "stop":()=>window.stopGeneration?.(),
    "send":()=>window.sendMessage?.()
  });

  function bind(){
    document.querySelectorAll("button[data-aizen-action]").forEach(button=>{
      if(button.dataset.aizenIndependentBound==="1") return;
      const actionName=button.dataset.aizenAction;
      const action=ACTIONS[actionName];
      if(typeof action!=="function") return;

      button.dataset.aizenIndependentBound="1";

      button.addEventListener("click",async event=>{
        if(button.disabled) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        try{
          const result=action();
          if(result && typeof result.then==="function") await result;
        }catch(error){
          console.error("AIZEN CONTROL ERROR:",actionName,error);
          if(typeof window.showToast==="function"){
            window.showToast("تعذر تنفيذ هذا الزر حالياً.");
          }
        }
      },{capture:true});
    });
  }

  function start(){
    bind();
    const observer=new MutationObserver(bind);
    observer.observe(document.documentElement,{subtree:true,childList:true});
    window.aizenIndependentRebind=bind;
  }

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();