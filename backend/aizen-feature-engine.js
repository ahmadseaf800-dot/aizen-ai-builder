/**
 * Aizen Platform Feature Engine
 * Ordered contracts for the Aizen Builder roadmap.
 * A feature is marked active only when its backend contract exists; foundation
 * means the supporting primitives exist but the complete product surface is
 * not yet verified end-to-end.
 */
const FEATURES = Object.freeze([
  ["coding_agent","AI Coding Agent"],
  ["workspace","Project Workspace"],
  ["self_repair","AI Self-Repair"],
  ["testing","Testing Engine"],
  ["preview","Live Preview"],
  ["terminal","Terminal"],
  ["github","GitHub Integration"],
  ["versions","Version History / Rollback"],
  ["memory","Project Memory"],
  ["router","Smart AI Router"],
  ["security","AI Security Scanner"],
  ["screenshot_to_site","Screenshot to Website"],
  ["voice","Voice Coding"],
  ["deploy","One-Click Deploy"],
  ["agents","AI Agents"],
  ["autonomous_builder","Autonomous Builder"]
].map(([id,name],index)=>Object.freeze({order:index+1,id,name})));

const FEATURE_STATUS = Object.freeze({
  coding_agent:"active",
  workspace:"active",
  self_repair:"foundation",
  testing:"foundation",
  preview:"foundation",
  terminal:"foundation",
  github:"foundation",
  versions:"active",
  memory:"foundation",
  router:"active",
  security:"active",
  screenshot_to_site:"foundation",
  voice:"foundation",
  deploy:"foundation",
  agents:"foundation",
  autonomous_builder:"foundation"
});

function listFeatures(){
  return FEATURES.map(f=>({...f,status:FEATURE_STATUS[f.id]||"planned"}));
}

function buildPlannerPrompt(request, projectContext=""){
  return [
    "Aizen Project Planner.",
    "Turn the request into an implementation plan without changing files.",
    "Return: goal, assumptions, architecture, file changes, dependencies, data flow, security risks, tests, deployment checks, acceptance criteria.",
    "Do not invent existing files; use the supplied project context.",
    "REQUEST:",String(request||"").slice(0,120000),
    "PROJECT CONTEXT:",String(projectContext||"").slice(0,120000)
  ].join("\n\n");
}

function buildSecurityPrompt(projectContext=""){
  return [
    "Aizen Security Scanner.",
    "Review the supplied project context for authentication, authorization, secrets, injection, XSS, SSRF, CSRF, path traversal, unsafe command execution, dependency risk and data exposure.",
    "For every finding provide severity, evidence, impact and a concrete remediation.",
    "Never output discovered secret values.",
    "PROJECT:",String(projectContext||"").slice(0,180000)
  ].join("\n\n");
}

function buildTestPrompt(projectContext="", request=""){
  return [
    "Aizen Testing Engine.",
    "Design executable tests for the requested behavior and existing project.",
    "Cover happy paths, validation failures, authorization, edge cases and regression risks.",
    "Return test files and exact commands only when they can be derived from the project.",
    "REQUEST:",String(request||"").slice(0,60000),
    "PROJECT:",String(projectContext||"").slice(0,160000)
  ].join("\n\n");
}

function compactMemory(items,maxChars=50000){
  const out=[]; let total=0;
  for(const item of (Array.isArray(items)?items:[]).slice(-200)){
    const text=String(item?.content||item?.summary||"").trim();
    if(!text) continue;
    const remaining=maxChars-total;
    if(remaining<=0) break;
    const value=text.slice(0,remaining);
    out.push({role:String(item?.role||"memory"),content:value});
    total+=value.length;
  }
  return out;
}

function validateAgentAction(action){
  const allowed=new Set(["plan","review","edit","test","security","repair","analyze","preview","terminal","deploy","github","version","memory","route","agent","autonomous"]);
  return allowed.has(String(action||"").toLowerCase());
}

function getNextRoadmapStage(completed=[]){
  const done=new Set(Array.isArray(completed)?completed.map(String):[]);
  return FEATURES.find(feature=>!done.has(feature.id))||null;
}

module.exports={FEATURES,FEATURE_STATUS,listFeatures,buildPlannerPrompt,buildSecurityPrompt,buildTestPrompt,compactMemory,validateAgentAction,getNextRoadmapStage};
