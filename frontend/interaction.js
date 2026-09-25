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
}
)();
/* AIZEN MONETIZATION + OWNER + MARKETPLACE UI */
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const money=(c,cur="USD")=>(Number(c||0)/100).toFixed(2)+" "+cur;
  let booted=false, owner=false, user=null;

  function css(){
    if($("aizen-money-style"))return;
    const s=document.createElement("style");s.id="aizen-money-style";s.textContent=`
      .aizen-money-bar{display:flex;gap:7px;align-items:center;margin:8px 12px;flex-wrap:wrap}
      .aizen-money-pill,.aizen-money-btn{border:1px solid var(--aizen-border,#30343e);background:var(--aizen-surface,#15181f);color:var(--aizen-text,#fff);border-radius:9px;padding:8px 10px;font-size:11px}
      .aizen-money-btn{cursor:pointer}.aizen-money-btn:hover{border-color:var(--aizen-accent,#6d5dfc)}
      .aizen-money-panel{position:fixed;inset:0;z-index:10050;background:rgba(0,0,0,.76);display:flex;align-items:center;justify-content:center;padding:16px}
      .aizen-money-box{width:min(980px,100%);max-height:88vh;overflow:auto;background:var(--aizen-surface,#101218);color:var(--aizen-text,#fff);border:1px solid var(--aizen-border,#30343e);border-radius:18px;padding:18px}
      .aizen-money-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:15px}.aizen-money-head h2{margin:0;font-size:20px}
      .aizen-money-close{border:0;background:transparent;color:inherit;font-size:24px;cursor:pointer}
      .aizen-money-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.aizen-money-card{padding:12px;border:1px solid var(--aizen-border,#30343e);border-radius:12px;background:var(--aizen-card,#15181f)}.aizen-money-card b{font-size:19px;display:block}.aizen-money-card span{color:var(--aizen-muted,#858b97);font-size:10px}
      .aizen-list{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.aizen-list-card{border:1px solid var(--aizen-border,#30343e);border-radius:13px;padding:13px;background:var(--aizen-card,#15181f)}.aizen-list-card h3{margin:0 0 7px;font-size:14px}.aizen-list-card p{color:var(--aizen-muted,#858b97);font-size:11px;min-height:34px}.aizen-price{font-size:17px;font-weight:800;margin:9px 0}
      .aizen-money-input{width:100%;padding:10px;border:1px solid var(--aizen-border,#30343e);border-radius:9px;background:var(--aizen-card,#15181f);color:inherit;margin:5px 0 10px}
      .aizen-primary{background:var(--aizen-accent,#6d5dfc)!important;color:#fff!important;border-color:var(--aizen-accent,#6d5dfc)!important}
      @media(max-width:700px){.aizen-money-grid{grid-template-columns:1fr 1fr}.aizen-list{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function panel(title,body){
    const p=document.createElement("div");p.className="aizen-money-panel";p.innerHTML=`<div class="aizen-money-box"><div class="aizen-money-head"><h2>${title}</h2><button class="aizen-money-close">×</button></div><div class="aizen-money-body">${body}</div></div>`;
    p.addEventListener("click",e=>{if(e.target===p||e.target.closest(".aizen-money-close"))p.remove()});document.body.appendChild(p);return p;
  }
  async function session(){
    if(typeof window.supabaseClient==="undefined")return null;
    const s=await window.supabaseClient.auth.getSession();return s?.data?.session||null;
  }
  async function refreshUser(){
    user=window.currentUser||null;if(!user){const s=await session();user=s?.user||null}
    if(!user||typeof window.supabaseClient==="undefined")return;
    try{
      const [{data:cred},{data:sub}]=await Promise.all([
        supabaseClient.from("user_credits").select("balance,lifetime_earned,lifetime_spent").eq("user_id",user.id).maybeSingle(),
        supabaseClient.from("user_subscriptions").select("status,plan_id").eq("user_id",user.id).in("status",["active","trialing"]).maybeSingle()
      ]);
      const pill=$("aizenCreditsPill");if(pill)pill.textContent="🪙 "+Number(cred?.balance||0)+" Credits";
      const pro=$("aizenProPill");if(pro)pro.textContent=sub?"⭐ Pro":"Free";
    }catch(e){console.warn("Aizen monetization refresh",e)}
  }
  async function checkOwner(){
    if(!user||typeof window.supabaseClient==="undefined")return false;
    try{const {data}=await supabaseClient.rpc("is_owner",{p_user_id:user.id});owner=!!data}catch(e){owner=false}
    const b=$("aizenOwnerBtn");if(b)b.classList.toggle("hidden",!owner);
    return owner;
  }
  async function ownerDashboard(){
    if(!(await checkOwner()))return;
    const p=panel("👑 لوحة المالك",'<div id="aizenOwnerContent">جاري تحميل البيانات...</div>');
    try{
      const {data,error}=await supabaseClient.from("owner_dashboard_summary").select("*").single();if(error)throw error;
      const d=data||{};p.querySelector("#aizenOwnerContent").innerHTML=`
        <div class="aizen-money-grid">
          <div class="aizen-money-card"><b>${Number(d.total_users||0)}</b><span>المستخدمون</span></div>
          <div class="aizen-money-card"><b>${Number(d.active_pro_users||0)}</b><span>Pro نشط</span></div>
          <div class="aizen-money-card"><b>${money(d.paid_revenue_cents)}</b><span>المدفوعات</span></div>
          <div class="aizen-money-card"><b>${Number(d.credits_spent||0)}</b><span>Credits مصروفة</span></div>
          <div class="aizen-money-card"><b>${Number(d.credits_earned||0)}</b><span>Credits مكتسبة</span></div>
          <div class="aizen-money-card"><b>${Number(d.published_listings||0)}</b><span>معروض للبيع</span></div>
          <div class="aizen-money-card"><b>${Number(d.marketplace_sales||0)}</b><span>مبيعات السوق</span></div>
          <div class="aizen-money-card"><b>${money(d.marketplace_revenue_cents)}</b><span>حصة Aizen من السوق</span></div>
        </div>
        <div style="margin-top:18px;color:var(--aizen-muted,#858b97);font-size:12px">هذه الصفحة لا تظهر إلا للمالك. يمكنك لاحقاً إضافة إدارة المستخدمين والمدفوعات والإعلانات والسحب من هنا.</div>`;
    }catch(e){p.querySelector("#aizenOwnerContent").textContent="تعذر تحميل لوحة المالك: "+(e.message||"خطأ")}
  }
  async function marketplace(){
    if(!user){window.openAuth?.();return}
    const p=panel("🛍️ Aizen Marketplace",'<div id="aizenMarketContent">جاري تحميل المشاريع...</div>');
    try{
      const {data,error}=await supabaseClient.from("marketplace_listings").select("id,title,description,price_cents,currency,seller_id,status").eq("status","published").order("created_at",{ascending:false});if(error)throw error;
      const items=data||[];
      p.querySelector("#aizenMarketContent").innerHTML=items.length?`<div class="aizen-list">${items.map(x=>`<div class="aizen-list-card"><h3>${esc(x.title)}</h3><p>${esc(x.description||"مشروع مبني بواسطة Aizen AI Builder")}</p><div class="aizen-price">${money(x.price_cents,x.currency)}</div><button class="aizen-money-btn aizen-primary" data-buy="${esc(x.id)}">بدء الشراء</button></div>`).join("")}</div>`:'<div style="text-align:center;padding:35px;color:#858b97">لا توجد مشاريع منشورة للبيع حالياً.</div>';
      p.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async()=>{const id=b.dataset.buy;const item=items.find(x=>x.id===id);if(!item)return;try{const {error}=await supabaseClient.from("marketplace_orders").insert({listing_id:item.id,buyer_id:user.id,seller_id:item.seller_id,amount_cents:item.price_cents,platform_fee_cents:Math.round(item.price_cents*.15),seller_net_cents:item.price_cents-Math.round(item.price_cents*.15),currency:item.currency,status:"pending"});if(error)throw error;alert("تم إنشاء طلب شراء بانتظار ربط بوابة الدفع.");}catch(e){alert(e.message||"تعذر إنشاء الطلب.")}});
    }catch(e){p.querySelector("#aizenMarketContent").textContent="تعذر تحميل السوق: "+(e.message||"خطأ")}
  }
  async function sellProject(){
    if(!user){window.openAuth?.();return}
    if(!Array.isArray(window.projects)||!window.projects.length){window.loadProjects?.();alert("أنشئ مشروعاً أولاً ثم حاول عرضه للبيع.");return}
    const options=window.projects.filter(x=>x&&x.id).map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("");
    const p=panel("💰 بيع مشروع",`<label>المشروع</label><select id="aizenSellProject" class="aizen-money-input">${options}</select><label>اسم العرض</label><input id="aizenSellTitle" class="aizen-money-input" placeholder="مثلاً: متجر إلكتروني احترافي"><label>الوصف</label><textarea id="aizenSellDesc" class="aizen-money-input" rows="4" placeholder="صف ما سيحصل عليه المشتري"></textarea><label>السعر بالدولار</label><input id="aizenSellPrice" class="aizen-money-input" type="number" min="1" step=".01" placeholder="20"><button id="aizenPublishSell" class="aizen-money-btn aizen-primary" style="width:100%">إرسال للسوق</button><div style="margin-top:8px;color:#858b97;font-size:10px">سيذهب العرض إلى المراجعة قبل نشره حسب إعدادات المنصة.</div>`);
    p.querySelector("#aizenPublishSell").onclick=async()=>{const projectId=p.querySelector("#aizenSellProject").value,title=p.querySelector("#aizenSellTitle").value.trim(),description=p.querySelector("#aizenSellDesc").value.trim(),price=Math.round(Number(p.querySelector("#aizenSellPrice").value)*100);if(!title||!price||price<100){alert("أدخل اسم العرض وسعراً صحيحاً.");return}try{const {error}=await supabaseClient.from("marketplace_listings").insert({seller_id:user.id,project_id:projectId,title,description,price_cents:price,status:"pending_review"});if(error)throw error;alert("تم إرسال المشروع للمراجعة.");p.remove()}catch(e){alert(e.message||"تعذر إرسال العرض.")}};
  }
  function mount(){
    if(booted)return;css();
    const header=document.querySelector(".header-right");if(!header)return;
    const bar=document.createElement("div");bar.className="aizen-money-bar";bar.innerHTML='<span id="aizenCreditsPill" class="aizen-money-pill">🪙 0 Credits</span><span id="aizenProPill" class="aizen-money-pill">Free</span><button id="aizenMarketBtn" class="aizen-money-btn">🛍️ السوق</button><button id="aizenSellBtn" class="aizen-money-btn">💰 بيع مشروعي</button><button id="aizenOwnerBtn" class="aizen-money-btn hidden">👑 لوحة المالك</button>';
    header.parentElement?.appendChild(bar);$("aizenMarketBtn").onclick=marketplace;$("aizenSellBtn").onclick=sellProject;$("aizenOwnerBtn").onclick=ownerDashboard;booted=true;
  }
  async function sync(){mount();await refreshUser();await checkOwner()}
  const timer=setInterval(()=>{if(window.currentUser){sync().catch(()=>{})}},1200);
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>sync().catch(()=>{}),{once:true});else sync().catch(()=>{});
  window.aizenOpenOwnerDashboard=ownerDashboard;window.aizenOpenMarketplace=marketplace;
})();


/* AIZEN MONETIZATION V2
   Free/Pro + Google AdSense + Marketplace + Owner Console.
   External payment settlement remains disabled until a real payment
   provider/webhook is configured; this layer never marks orders as paid.
*/
(function(){
  "use strict";
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  const money=(c,cur="USD")=>(Number(c||0)/100).toFixed(2)+" "+cur;
  let adsenseConfig=null, adsenseLoaded=false, v2Mounted=false;

  function style(){
    if($("aizen-money-v2-style"))return;
    const s=document.createElement("style");s.id="aizen-money-v2-style";s.textContent=`
      .aizen-v2-bar{display:flex;gap:7px;align-items:center;flex-wrap:wrap;margin:8px 12px}
      .aizen-v2-pill,.aizen-v2-btn{border:1px solid var(--aizen-border,#30343e);background:var(--aizen-surface,#15181f);color:var(--aizen-text,#fff);border-radius:9px;padding:8px 10px;font-size:11px}
      .aizen-v2-btn{cursor:pointer}.aizen-v2-btn:hover{border-color:var(--aizen-accent,#6d5dfc)}
      .aizen-v2-primary{background:var(--aizen-accent,#6d5dfc)!important;color:#fff!important;border-color:var(--aizen-accent,#6d5dfc)!important}
      .aizen-v2-panel{position:fixed;inset:0;z-index:10060;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:14px}
      .aizen-v2-box{width:min(1050px,100%);max-height:90vh;overflow:auto;background:var(--aizen-surface,#101218);color:var(--aizen-text,#fff);border:1px solid var(--aizen-border,#30343e);border-radius:18px;padding:18px}
      .aizen-v2-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px}.aizen-v2-head h2{margin:0;font-size:19px}
      .aizen-v2-close{border:0;background:transparent;color:inherit;font-size:25px;cursor:pointer}
      .aizen-v2-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.aizen-v2-card{padding:12px;border:1px solid var(--aizen-border,#30343e);border-radius:12px;background:var(--aizen-card,#15181f)}.aizen-v2-card b{display:block;font-size:18px}.aizen-v2-card span{font-size:10px;color:var(--aizen-muted,#858b97)}
      .aizen-v2-list{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.aizen-v2-item{padding:13px;border:1px solid var(--aizen-border,#30343e);border-radius:12px;background:var(--aizen-card,#15181f)}
      .aizen-v2-item h3{margin:0 0 7px;font-size:14px}.aizen-v2-item p{font-size:11px;color:var(--aizen-muted,#858b97);min-height:34px}
      .aizen-v2-input{width:100%;box-sizing:border-box;padding:10px;margin:5px 0 10px;border:1px solid var(--aizen-border,#30343e);border-radius:9px;background:var(--aizen-card,#15181f);color:inherit}
      .aizen-v2-table{width:100%;border-collapse:collapse;font-size:11px;margin-top:10px}.aizen-v2-table th,.aizen-v2-table td{padding:8px;border-bottom:1px solid var(--aizen-border,#30343e);text-align:right}
      .aizen-v2-ad{width:min(100%,970px);min-height:90px;margin:10px auto;text-align:center;overflow:hidden}
      @media(max-width:700px){.aizen-v2-grid{grid-template-columns:1fr 1fr}.aizen-v2-list{grid-template-columns:1fr}}
    `;document.head.appendChild(s);
  }
  function panel(title,body){
    const p=document.createElement("div");p.className="aizen-v2-panel";
    p.innerHTML=`<div class="aizen-v2-box"><div class="aizen-v2-head"><h2>${title}</h2><button class="aizen-v2-close">×</button></div><div class="aizen-v2-body">${body}</div></div>`;
    p.addEventListener("click",e=>{if(e.target===p||e.target.closest(".aizen-v2-close"))p.remove()});
    document.body.appendChild(p);return p;
  }
  function sb(){return window.supabaseClient||null}
  async function currentUser(){
    if(window.currentUser)return window.currentUser;
    const s=sb()?await sb().auth.getSession():null;
    return s?.data?.session?.user||null;
  }
  async function proStatus(user){
    if(!user||!sb())return false;
    const {data}=await sb().from("user_subscriptions").select("status").eq("user_id",user.id).in("status",["active","trialing"]).maybeSingle();
    return !!data;
  }
  async function loadAdsenseConfig(){
    if(!sb())return null;
    const {data}=await sb().from("adsense_settings").select("enabled,publisher_id,free_users_only,top_slot,marketplace_slot").eq("id",1).maybeSingle();
    adsenseConfig=data||null;return adsenseConfig;
  }
  async function loadAdsense(){
    const cfg=await loadAdsenseConfig();if(!cfg?.enabled||!cfg.publisher_id)return;
    const user=await currentUser();const isPro=await proStatus(user);
    if(cfg.free_users_only&&isPro)return;
    if(!cfg.top_slot)return;
    let host=document.getElementById("aizenAdSenseTop");
    if(!host){
      host=document.createElement("div");host.id="aizenAdSenseTop";host.className="aizen-v2-ad";
      const anchor=document.querySelector(".chat-area")||document.querySelector(".messages")||document.querySelector(".header");
      anchor?.parentNode?.insertBefore(host,anchor);
    }
    if(!host||host.dataset.ready==="1")return;
    host.innerHTML=`<ins class="adsbygoogle" style="display:block" data-ad-client="${esc(cfg.publisher_id)}" data-ad-slot="${esc(cfg.top_slot)}" data-ad-format="auto" data-full-width-responsive="true"></ins>`;
    if(!adsenseLoaded){
      const script=document.createElement("script");script.async=true;script.crossOrigin="anonymous";
      script.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(cfg.publisher_id);
      document.head.appendChild(script);adsenseLoaded=true;
    }
    host.dataset.ready="1";
    try{(window.adsbygoogle=window.adsbygoogle||[]).push({})}catch(e){}
  }
  async function refreshBar(){
    const u=await currentUser();if(!u||!sb())return;
    const [{data:c},{data:s}]=await Promise.all([
      sb().from("user_credits").select("balance").eq("user_id",u.id).maybeSingle(),
      sb().from("user_subscriptions").select("status,plan_id").eq("user_id",u.id).in("status",["active","trialing"]).maybeSingle()
    ]);
    const a=$("aizenV2Credits"),p=$("aizenV2Plan");if(a)a.textContent="🪙 "+Number(c?.balance||0)+" Credits";if(p)p.textContent=s?"⭐ Pro":"Free";
    const proBtn=$("aizenV2Pro");if(proBtn)proBtn.textContent=s?"⭐ Pro فعال":"⭐ ترقية إلى Pro";
    await loadAdsense();
  }
  async function showPlans(){
    const u=await currentUser();if(!u){window.openAuth?.();return}
    const {data:plans,error}=await sb().from("monetization_plans").select("id,name,price_cents,currency,monthly_credits,show_ads,priority_builds,description").eq("is_active",true).order("price_cents");
    if(error){alert(error.message);return}
    const p=panel("⭐ Free / Pro",`<div class="aizen-v2-list">${(plans||[]).map(x=>`<div class="aizen-v2-item"><h3>${esc(x.name)}</h3><p>${esc(x.description||"")}</p><strong>${money(x.price_cents,x.currency)} / شهر</strong><div style="margin:8px 0;font-size:11px">🪙 ${Number(x.monthly_credits||0)} Credits<br>📢 ${x.show_ads?"إعلانات":"بدون إعلانات"}<br>⚡ ${x.priority_builds?"أولوية بناء":"عادي"}</div><button class="aizen-v2-btn aizen-v2-primary" data-plan="${esc(x.id)}">${x.price_cents?"شراء/ترقية":"الخطة الحالية"}</button></div>`).join("")}</div><p style="font-size:11px;color:var(--aizen-muted,#858b97);margin-top:14px">الدفع الحقيقي لا يُعتبر ناجحاً من الواجهة وحدها؛ يجب ربط بوابة دفع وWebhook قبل تفعيل الاشتراك تلقائياً.</p>`);
    p.querySelectorAll("[data-plan]").forEach(b=>b.onclick=()=>alert("الخطة جاهزة في Supabase، لكن بوابة الدفع الخارجية لم تُربط بعد. لن يتم خصم أي مبلغ أو تفعيل Pro من هذا الزر."));
  }
  async function marketplace(){
    const u=await currentUser();if(!u){window.openAuth?.();return}
    const p=panel("🛍️ Aizen Marketplace",'<div id="aizenV2Market">جاري التحميل...</div>');
    try{
      const [{data:list,error},{data:settings}]=await Promise.all([
        sb().from("marketplace_listings").select("id,title,description,price_cents,currency,seller_id,preview_url,cover_url").eq("status","published").order("created_at",{ascending:false}),
        sb().from("marketplace_settings").select("default_platform_fee_percent,min_listing_price_cents,max_listing_price_cents").eq("id",1).maybeSingle()
      ]);
      if(error)throw error;const fee=Number(settings?.default_platform_fee_percent||15);
      const items=list||[];
      p.querySelector("#aizenV2Market").innerHTML=items.length?`<div class="aizen-v2-list">${items.map(x=>`<div class="aizen-v2-item">${x.cover_url?`<img src="${esc(x.cover_url)}" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px">`:""}<h3>${esc(x.title)}</h3><p>${esc(x.description||"مشروع مبني بواسطة Aizen AI Builder")}</p><div style="font-size:17px;font-weight:800">${money(x.price_cents,x.currency)}</div>${x.preview_url?`<a href="${esc(x.preview_url)}" target="_blank" rel="noopener" class="aizen-v2-btn" style="display:inline-block;margin:8px 0;text-decoration:none">معاينة</a>`:""}<button class="aizen-v2-btn aizen-v2-primary" data-buy="${esc(x.id)}">بدء الشراء</button></div>`).join("")}</div>`:'<div style="padding:30px;text-align:center;color:#858b97">لا توجد مشاريع منشورة للبيع حالياً.</div>';
      p.querySelectorAll("[data-buy]").forEach(b=>b.onclick=async()=>{
        const item=items.find(x=>x.id===b.dataset.buy);if(!item)return;
        try{
          const feeCents=Math.round(Number(item.price_cents)*fee/100);
          const net=Number(item.price_cents)-feeCents;
          const {error:e}=await sb().from("marketplace_orders").insert({listing_id:item.id,buyer_id:u.id,seller_id:item.seller_id,amount_cents:item.price_cents,platform_fee_cents:feeCents,seller_net_cents:net,currency:item.currency,status:"pending"});
          if(e)throw e;
          alert("تم إنشاء طلب شراء آمن بانتظار بوابة الدفع. لم يتم خصم أي مبلغ.");
        }catch(e){alert(e.message||"تعذر إنشاء الطلب.")}
      });
    }catch(e){p.querySelector("#aizenV2Market").textContent="تعذر تحميل السوق: "+(e.message||"خطأ")}
  }
  async function sellProject(){
    const u=await currentUser();if(!u){window.openAuth?.();return}
    const {data:projects,error}=await sb().from("projects").select("id,name").eq("user_id",u.id).order("updated_at",{ascending:false});
    if(error||!projects?.length){alert("أنشئ مشروعاً أولاً ثم حاول عرضه للبيع.");return}
    const p=panel("💰 بيع مشروعي",`<label>المشروع</label><select id="aizenV2SellProject" class="aizen-v2-input">${projects.map(x=>`<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}</select><label>اسم العرض</label><input id="aizenV2SellTitle" class="aizen-v2-input" placeholder="مثلاً: متجر إلكتروني احترافي"><label>الوصف</label><textarea id="aizenV2SellDesc" class="aizen-v2-input" rows="4" placeholder="ماذا سيحصل عليه المشتري؟"></textarea><label>السعر بالدولار</label><input id="aizenV2SellPrice" class="aizen-v2-input" type="number" min="1" step=".01" placeholder="20"><button id="aizenV2Publish" class="aizen-v2-btn aizen-v2-primary" style="width:100%">إرسال للمراجعة</button>`);
    p.querySelector("#aizenV2Publish").onclick=async()=>{
      const projectId=p.querySelector("#aizenV2SellProject").value,title=p.querySelector("#aizenV2SellTitle").value.trim(),description=p.querySelector("#aizenV2SellDesc").value.trim(),price=Math.round(Number(p.querySelector("#aizenV2SellPrice").value)*100);
      if(!title||price<100){alert("أدخل اسم العرض وسعراً لا يقل عن 1$.");return}
      const {data:ms}=await sb().from("marketplace_settings").select("min_listing_price_cents,max_listing_price_cents,require_owner_approval").eq("id",1).maybeSingle();
      if(price<Number(ms?.min_listing_price_cents||100)||price>Number(ms?.max_listing_price_cents||10000000)){alert("السعر خارج حدود السوق.");return}
      const {error}=await sb().from("marketplace_listings").insert({seller_id:u.id,project_id:projectId,title,description,price_cents:price,status:ms?.require_owner_approval===false?"published":"pending_review"});
      if(error){alert(error.message);return}alert("تم إرسال العرض للسوق.");p.remove();
    };
  }
  async function ownerDashboard(){
    const u=await currentUser();if(!u||!sb())return;
    const {data:isOwner}=await sb().rpc("is_owner",{p_user_id:u.id});if(!isOwner){alert("غير مصرح.");return}
    const p=panel("👑 Owner Dashboard",'<div id="aizenV2Owner">جاري تحميل بيانات المالك...</div>');
    try{
      const [{data:sum},{data:pay},{data:subs},{data:credits},{data:orders},{data:adsCfg}]=await Promise.all([
        sb().from("owner_dashboard_summary").select("*").single(),
        sb().from("payment_transactions").select("id,user_id,amount_cents,currency,status,provider,paid_at,created_at").order("created_at",{ascending:false}).limit(20),
        sb().from("user_subscriptions").select("user_id,plan_id,status,current_period_end,created_at").order("created_at",{ascending:false}).limit(20),
        sb().from("credit_transactions").select("user_id,type,amount,balance_after,description,created_at").order("created_at",{ascending:false}).limit(30),
        sb().from("marketplace_orders").select("id,listing_id,buyer_id,seller_id,amount_cents,platform_fee_cents,seller_net_cents,currency,status,payment_provider,provider_payment_id,created_at").order("created_at",{ascending:false}).limit(30),
        sb().from("adsense_settings").select("enabled,publisher_id,free_users_only,top_slot,marketplace_slot,updated_at").eq("id",1).single()
      ]);
      const d=sum||{};
      p.querySelector("#aizenV2Owner").innerHTML=`
        <div class="aizen-v2-grid">
          <div class="aizen-v2-card"><b>${Number(d.total_users||0)}</b><span>المستخدمون</span></div>
          <div class="aizen-v2-card"><b>${Number(d.active_pro_users||0)}</b><span>Pro نشط</span></div>
          <div class="aizen-v2-card"><b>${money(d.paid_revenue_cents)}</b><span>إيرادات Pro</span></div>
          <div class="aizen-v2-card"><b>${Number(d.credits_spent||0)}</b><span>Credits مصروفة</span></div>
          <div class="aizen-v2-card"><b>${Number(d.published_listings||0)}</b><span>عروض منشورة</span></div>
          <div class="aizen-v2-card"><b>${Number(d.marketplace_sales||0)}</b><span>مبيعات السوق</span></div>
          <div class="aizen-v2-card"><b>${money(d.marketplace_revenue_cents)}</b><span>حصة المنصة</span></div>
          <div class="aizen-v2-card"><b>${money(d.seller_payouts_cents)}</b><span>مستحقات البائعين</span></div>
        </div>
        <hr style="border-color:var(--aizen-border,#30343e);margin:18px 0">
        <h3>📢 Google AdSense</h3>
        <label>Publisher ID</label><input id="aizenAdsPublisher" class="aizen-v2-input" value="${esc(adsCfg?.publisher_id||"")}" placeholder="ca-pub-XXXXXXXXXXXXXXXX">
        <label>Top Ad Slot</label><input id="aizenAdsTopSlot" class="aizen-v2-input" value="${esc(adsCfg?.top_slot||"")}" placeholder="1234567890">
        <label>Marketplace Ad Slot</label><input id="aizenAdsMarketSlot" class="aizen-v2-input" value="${esc(adsCfg?.marketplace_slot||"")}" placeholder="1234567890">
        <label style="display:block;margin:7px 0"><input id="aizenAdsEnabled" type="checkbox" ${adsCfg?.enabled?"checked":""}> تفعيل AdSense</label>
        <label style="display:block;margin:7px 0"><input id="aizenAdsFreeOnly" type="checkbox" ${adsCfg?.free_users_only!==false?"checked":""}> الإعلانات للمستخدم المجاني فقط</label>
        <button id="aizenAdsSave" class="aizen-v2-btn aizen-v2-primary">حفظ إعدادات AdSense</button>
        ${adsCfg?.publisher_id?`<a href="https://adsense.google.com/" target="_blank" rel="noopener" class="aizen-v2-btn" style="display:inline-block;margin-right:7px;text-decoration:none">فتح AdSense</a>`:""}
        <p style="font-size:10px;color:var(--aizen-muted,#858b97)">الأرباح الفعلية والنقرات والتقارير المالية تبقى في Google AdSense؛ لا نخترع أرقاماً داخل Aizen.</p>
        <h3>💳 آخر المدفوعات</h3><div style="overflow:auto"><table class="aizen-v2-table"><tr><th>المبلغ</th><th>الحالة</th><th>المزوّد</th><th>التاريخ</th></tr>${(pay||[]).map(x=>`<tr><td>${money(x.amount_cents,x.currency)}</td><td>${esc(x.status)}</td><td>${esc(x.provider||"-")}</td><td>${esc(x.created_at||"")}</td></tr>`).join("")}</table></div>
        <h3>⭐ اشتراكات Pro</h3><div style="overflow:auto"><table class="aizen-v2-table"><tr><th>المستخدم</th><th>الخطة</th><th>الحالة</th><th>النهاية</th></tr>${(subs||[]).map(x=>`<tr><td>${esc(x.user_id)}</td><td>${esc(x.plan_id)}</td><td>${esc(x.status)}</td><td>${esc(x.current_period_end||"-")}</td></tr>`).join("")}</table></div>
        <h3>🪙 حركة Credits</h3><div style="overflow:auto"><table class="aizen-v2-table"><tr><th>المستخدم</th><th>النوع</th><th>المقدار</th><th>التاريخ</th></tr>${(credits||[]).map(x=>`<tr><td>${esc(x.user_id)}</td><td>${esc(x.type)}</td><td>${Number(x.amount||0)}</td><td>${esc(x.created_at||"")}</td></tr>`).join("")}</table></div>
        <h3>🛍️ آخر طلبات السوق</h3><div style="overflow:auto"><table class="aizen-v2-table"><tr><th>المبلغ</th><th>حصة Aizen</th><th>البائع</th><th>الحالة</th></tr>${(orders||[]).map(x=>`<tr><td>${money(x.amount_cents,x.currency)}</td><td>${money(x.platform_fee_cents,x.currency)}</td><td>${esc(x.seller_id)}</td><td>${esc(x.status)}</td></tr>`).join("")}</table></div>
      `;
      p.querySelector("#aizenAdsSave").onclick=async()=>{
        const patch={enabled:p.querySelector("#aizenAdsEnabled").checked,free_users_only:p.querySelector("#aizenAdsFreeOnly").checked,publisher_id:p.querySelector("#aizenAdsPublisher").value.trim()||null,top_slot:p.querySelector("#aizenAdsTopSlot").value.trim()||null,marketplace_slot:p.querySelector("#aizenAdsMarketSlot").value.trim()||null,updated_at:new Date().toISOString()};
        const {error}=await sb().from("adsense_settings").update(patch).eq("id",1);if(error)alert(error.message);else{alert("تم حفظ إعدادات AdSense.");adsenseConfig=patch;loadAdsense().catch(()=>{})}
      };
    }catch(e){p.querySelector("#aizenV2Owner").textContent="تعذر تحميل لوحة المالك: "+(e.message||"خطأ")}
  }
  function mount(){
    if(v2Mounted)return;style();
    document.querySelectorAll(".aizen-money-bar").forEach(x=>x.remove());
    const header=document.querySelector(".header-right")||document.querySelector(".header");
    if(!header)return;
    const bar=document.createElement("div");bar.className="aizen-v2-bar";bar.innerHTML='<span id="aizenV2Credits" class="aizen-v2-pill">🪙 0 Credits</span><span id="aizenV2Plan" class="aizen-v2-pill">Free</span><button id="aizenV2Pro" class="aizen-v2-btn">⭐ ترقية إلى Pro</button><button id="aizenV2Market" class="aizen-v2-btn">🛍️ السوق</button><button id="aizenV2Sell" class="aizen-v2-btn">💰 بيع مشروعي</button><button id="aizenV2Owner" class="aizen-v2-btn" style="display:none">👑 لوحة المالك</button>';
    header.parentElement?.appendChild(bar);
    $("aizenV2Pro").onclick=showPlans;$("aizenV2Market").onclick=marketplace;$("aizenV2Sell").onclick=sellProject;$("aizenV2Owner").onclick=ownerDashboard;
    v2Mounted=true;
  }
  async function sync(){
    mount();const u=await currentUser();if(!u)return;
    await refreshBar();
    const {data:own}=await sb().rpc("is_owner",{p_user_id:u.id});const b=$("aizenV2Owner");if(b)b.style.display=own?"inline-block":"none";
  }
  const start=()=>{style();sync().catch(e=>console.warn("Aizen monetization v2",e))};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start,{once:true});else start();
  window.aizenOpenOwnerDashboard=ownerDashboard;window.aizenOpenMarketplace=marketplace;
})();
