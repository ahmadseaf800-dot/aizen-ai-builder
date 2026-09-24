/* Aizen Independent Interaction Layer
 * Fresh event binding for primary controls.
 * It intentionally does not depend on the previous event listeners.
 */
(function(){
  "use strict";

  const waitFor = (fn, timeout=8000) => new Promise(resolve=>{
    const started=Date.now();
    const tick=()=>{
      if(typeof window[fn]==="function") return resolve(window[fn]);
      if(Date.now()-started>=timeout) return resolve(null);
      setTimeout(tick,100);
    };
    tick();
  });

  async function bind(){
    const actions={
      "open-auth":"openAuth",
      "toggle-account":"aizenToggleAccountFresh",
      "new-chat":"newChat",
      "tab-chats":"showSidebarTab",
      "tab-projects":"showSidebarTab",
      "attach":"triggerFileUpload",
      "agent":"openAgentModal",
      "build":"openBuildTypeModal",
      "stop":"stopGeneration",
      "send":"sendMessage"
    };

    document.querySelectorAll("button[data-aizen-action]").forEach(button=>{
      if(button.dataset.aizenIndependentBound==="1") return;
      const actionName=button.dataset.aizenAction;
      if(!actions[actionName]) return;
      button.dataset.aizenIndependentBound="1";
      button.addEventListener("click",async event=>{
        if(button.disabled) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        try{
          const fn=await waitFor(actions[actionName]);
          if(!fn) throw new Error("AIZEN_ACTION_UNAVAILABLE");
          if(actionName==="tab-chats") return fn("chats");
          if(actionName==="tab-projects") return fn("projects");
          return fn();
        }catch(error){
          console.error("AIZEN INDEPENDENT ACTION ERROR",error);
          if(typeof window.showToast==="function") window.showToast("تعذر تنفيذ الزر حالياً.");
        }
      },true);
    });
  }

  const start=()=>{
    bind();
    const observer=new MutationObserver(()=>bind());
    observer.observe(document.documentElement,{subtree:true,childList:true});
    window.aizenIndependentRebind=bind;
  };

  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded",start,{once:true});
  }else{
    start();
  }
})();