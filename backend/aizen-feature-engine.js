/**
 * Aizen Platform Feature Engine
 * Ordered contracts for the Aizen Builder roadmap.
 */
const BUILD_TYPES = Object.freeze({
  website:{label:"موقع ويب",examples:["متجر إلكتروني مع سلة شراء ولوحة تحكم","موقع شركة حديث ومتجاوب","منصة SaaS مع تسجيل دخول"]},
  app:{label:"تطبيق",examples:["تطبيق مهام مع حسابات ومزامنة","تطبيق متجر للهاتف","تطبيق إدارة مصروفات"]},
  telegram_bot:{label:"بوت Telegram",examples:["بوت إدارة مجموعات","بوت متجر مع أوامر ولوحة تحكم","بوت تذاكر ودعم"]},
  discord_bot:{label:"بوت Discord",examples:["بوت إدارة وحماية","بوت تذاكر","بوت اقتصاد ومجتمع"]},
  game:{label:"لعبة",examples:["لعبة 2D","لعبة ألغاز","لعبة متعددة اللاعبين"]},
  browser_extension:{label:"إضافة للمتصفح",examples:["إضافة إدارة تبويبات","إضافة أدوات للمطورين","إضافة تخصيص صفحات"]},
  game_mod:{label:"تطوير إضافات للألعاب",examples:["Minecraft Fabric mod","Minecraft Paper/Purpur plugin","تصميم سكن لبطل في Mobile Legends","تصميم سكن/محتوى لـPUBG"]},
  api:{label:"API / Backend",examples:["REST API مع Auth","Backend لمنصة SaaS","خدمة Webhook"]},
  automation:{label:"أتمتة",examples:["معالجة ملفات تلقائية","ربط خدمات عبر Webhooks","مهام مجدولة"]},
  custom:{label:"مشروع مخصص",examples:["اكتب فكرتك وسيتولى Aizen اختيار البنية"]}
});
const FEATURES = Object.freeze([
  ["coding_agent","AI Coding Agent"],["workspace","Project Workspace"],["self_repair","AI Self-Repair"],["testing","Testing Engine"],["preview","Live Preview"],["terminal","Terminal"],["dependencies","Dependency Manager"],["github","GitHub Integration"],["versions","Version History / Rollback"],["memory","Project Memory"],["planner","AI Project Planner"],["router","Smart AI Router"],["security","AI Security Scanner"],["screenshot_to_site","Screenshot to Website"],["voice","Voice Coding"],["deploy","One-Click Deploy"],["agents","AI Agents"],["autonomous_builder","Autonomous Builder"]
].map(([id,name],index)=>Object.freeze({order:index+1,id,name})));
const FEATURE_STATUS=Object.freeze({coding_agent:"active",workspace:"active",self_repair:"foundation",testing:"foundation",preview:"foundation",terminal:"foundation",dependencies:"foundation",github:"foundation",versions:"active",memory:"foundation",planner:"active",router:"active",security:"active",screenshot_to_site:"foundation",voice:"foundation",deploy:"foundation",agents:"foundation",autonomous_builder:"foundation"});
function listFeatures(){return FEATURES.map(f=>({...f,status:FEATURE_STATUS[f.id]||"planned"}));}
function listBuildTypes(){return Object.entries(BUILD_TYPES).map(([id,v])=>({id,...v}));}
function getBuildType(type){return BUILD_TYPES[String(type||"").trim()]||BUILD_TYPES.custom;}
function buildPlannerPrompt(request,projectContext="",type="custom"){const spec=getBuildType(type);return ["Aizen Project Planner.","Turn the request into a real implementation plan, not a mockup.","Return: goal, assumptions, architecture, files, dependencies, data flow, security, tests, preview/deploy plan and acceptance criteria.","Build type:",spec.label,"Examples:",spec.examples.join(" | "),"Never invent existing files; use supplied project context.","REQUEST:",String(request||"").slice(0,120000),"PROJECT CONTEXT:",String(projectContext||"").slice(0,120000)].join("\n\n");}
function buildSecurityPrompt(projectContext=""){return ["Aizen Security Scanner.","Review authentication, authorization, secrets, injection, XSS, SSRF, CSRF, path traversal, unsafe commands, dependency risk and data exposure.","For every finding provide severity, evidence, impact and concrete remediation.","Never output discovered secret values.","PROJECT:",String(projectContext||"").slice(0,180000)].join("\n\n");}
function buildTestPrompt(projectContext="",request=""){return ["Aizen Testing Engine.","Design executable tests for the requested behavior and existing project.","Cover happy paths, validation failures, authorization, edge cases and regression risks.","Return test files and exact commands only when derivable from the project.","REQUEST:",String(request||"").slice(0,60000),"PROJECT:",String(projectContext||"").slice(0,160000)].join("\n\n");}
function buildSelfRepairPrompt(error,projectContext=""){return ["Aizen Self-Repair Agent.","Inspect the error and project context, identify root cause, make the smallest safe fix, and define a verification command and regression test.","Never claim execution unless a runtime actually executed it.","ERROR:",String(error||"").slice(0,30000),"PROJECT:",String(projectContext||"").slice(0,170000)].join("\n\n");}
function buildBuildPrompt(request,type,projectContext=""){const spec=getBuildType(type);return ["Aizen Builder execution contract.",`Build type: ${spec.label}.`,`Examples: ${spec.examples.join(" | ")}.`,`Request: ${String(request||"").slice(0,120000)}`,"Build a complete coherent project, not a decorative mockup. Include frontend/backend/database/auth/configuration when the requirement needs them.","Keep secrets out of model context and source files. For Telegram/Discord, verify the token server-side, save it only in the secret store, and use environment variables in generated code.","Project context:",String(projectContext||"").slice(0,120000)].join("\n\n");}
function compactMemory(items,maxChars=50000){const out=[];let total=0;for(const item of(Array.isArray(items)?items:[]).slice(-200)){const text=String(item?.content||item?.summary||"").trim();if(!text)continue;const remaining=maxChars-total;if(remaining<=0)break;const value=text.slice(0,remaining);out.push({role:String(item?.role||"memory"),content:value});total+=value.length;}return out;}
function validateAgentAction(action){return new Set(["plan","review","edit","test","security","repair","analyze","build","preview","terminal","deploy","github","version","memory","route","agent","autonomous"]).has(String(action||"").toLowerCase());}
function getNextRoadmapStage(completed=[]){const done=new Set(Array.isArray(completed)?completed.map(String):[]);return FEATURES.find(f=>!done.has(f.id))||null;}
module.exports={FEATURES,FEATURE_STATUS,BUILD_TYPES,listFeatures,listBuildTypes,getBuildType,buildPlannerPrompt,buildSecurityPrompt,buildTestPrompt,buildSelfRepairPrompt,buildBuildPrompt,compactMemory,validateAgentAction,getNextRoadmapStage};
