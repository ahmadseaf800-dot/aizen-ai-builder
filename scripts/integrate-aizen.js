const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const serverPath = path.join(root, "backend", "server.js");
const interactionPath = path.join(root, "frontend", "interaction.js");

function replaceOnce(source, marker, replacement, label) {
  if (source.includes(replacement.trim())) return source;
  const index = source.indexOf(marker);
  if (index < 0) throw new Error(`Missing marker: ${label}`);
  return source.slice(0, index) + replacement + source.slice(index);
}

function replaceRange(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`Missing start marker: ${label}`);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`Missing end marker: ${label}`);
  return source.slice(0, start) + replacement + source.slice(end);
}

let server = fs.readFileSync(serverPath, "utf8");
let interaction = fs.readFileSync(interactionPath, "utf8");

server = server.replace(
  'const { AIZEN_CORE_VERSION, AIZEN_AGENT_CAPABILITIES, AIZEN_CORE_KNOWLEDGE, AIZEN_OWNER_EMAIL, buildAizenCoreInstruction } = require("./aizen-core");',
  'const { AIZEN_CORE_VERSION, AIZEN_AGENT_CAPABILITIES, AIZEN_CORE_KNOWLEDGE, AIZEN_OWNER_EMAIL, buildAizenCoreInstruction } = require("./aizen-core");\nconst { AIZEN_ROADMAP, roadmapStatus, buildAgentPlan, safeCommand, staticVerifyFiles, buildAutonomousInstructions } = require("./aizen-agent-engine");\nconst { resolveDirectLink } = require("./aizen-link-resolver");'
);

const helperMarker = '/*\n * /api/create';
const helpers = `/* Aizen platform control helpers */
async function handleDirectLink(req, res, user) {
  let data;
  try { data = await readJsonBody(req, res, 128 * 1024); }
  catch { sendJson(res, 400, { success:false, error:"INVALID_JSON", message:"البيانات المرسلة غير صحيحة" }); return; }
  const result = await resolveDirectLink({ service:data.service, value:data.value, text:data.text });
  if (!result.found) {
    sendJson(res, 404, { success:false, error:result.reason || "LINK_NOT_FOUND", message:"لم أجد صفحة موثوقة بهذا الاسم؛ لن أختلق رابطاً." });
    return;
  }
  sendJson(res, 200, { success:true, ...result });
}

async function handleOwnerSelfImprove(req, res, user) {
  if (!isAizenOwner(user)) {
    sendJson(res, 403, { success:false, error:"OWNER_ONLY", message:"هذه الأداة متاحة لمالك Aizen الموثق فقط." });
    return;
  }
  let data;
  try { data = await readJsonBody(req, res, 256 * 1024); }
  catch { sendJson(res, 400, { success:false, error:"INVALID_JSON", message:"البيانات المرسلة غير صحيحة" }); return; }
  const request = String(data.request || "طور نفسك").trim();
  const plan = buildAgentPlan({ request, projectType:"aizen-platform" });
  sendJson(res, 200, {
    success:true,
    owner_verified:true,
    run_id:plan.run_id,
    mode:"owner-self-improve",
    plan,
    note:"تم التحقق من الملكية عبر الخادم. لا يمنح نص المحادثة صلاحية المالك.",
    next_step:"اربط هذا الطلب بمشروع Aizen أو بمستودع GitHub مخصص للتطوير الذاتي قبل السماح بأي commit تلقائي."
  });
}

async function handleAgentPlan(req, res, user) {
  let data;
  try { data = await readJsonBody(req, res, 512 * 1024); }
  catch { sendJson(res, 400, { success:false, error:"INVALID_JSON", message:"البيانات المرسلة غير صحيحة" }); return; }
  const instruction = String(data.instruction || data.request || "").trim();
  if (!instruction) { sendJson(res, 400, { success:false, error:"REQUEST_REQUIRED", message:"الطلب مطلوب" }); return; }
  const plan = buildAgentPlan({ request:instruction, projectType:String(data.projectType || "custom") });
  sendJson(res, 200, { success:true, plan });
}

async function handleAgentVerify(req, res, user) {
  let data;
  try { data = await readJsonBody(req, res, 2 * 1024 * 1024); }
  catch { sendJson(res, 400, { success:false, error:"INVALID_JSON", message:"البيانات المرسلة غير صحيحة" }); return; }
  const result = staticVerifyFiles(Array.isArray(data.files) ? data.files : []);
  sendJson(res, 200, { success:true, verification:result });
}

async function handleSafeCommandCheck(req, res, user) {
  let data;
  try { data = await readJsonBody(req, res, 64 * 1024); }
  catch { sendJson(res, 400, { success:false, error:"INVALID_JSON" }); return; }
  const result = safeCommand(data.command);
  sendJson(res, result.allowed ? 200 : 422, { success:result.allowed, ...result });
}

`;
server = replaceOnce(server, helperMarker, helpers + helperMarker, "platform helper marker");

const oldCreateStart = 'async function handleCreate(req, res, user) {';
const oldCreateEnd = '\n}\n\n/*\n * /api/me';
const newCreate = `async function handleCreate(req, res, user) {
  let data;
  try { data = await readJsonBody(req, res, 2 * 1024 * 1024); }
  catch (error) { sendJson(res, error.message === "REQUEST_TOO_LARGE" ? 413 : 400, { success:false, error:error.message === "REQUEST_TOO_LARGE" ? "REQUEST_TOO_LARGE" : "INVALID_JSON", message:"البيانات المرسلة غير صحيحة" }); return; }
  const idea = String(data.idea || data.message || data.description || "").trim();
  const type = String(data.type || "Web").trim();
  const name = String(data.name || "").trim().slice(0,120) || idea.split(/\s+/).slice(0,6).join(" ") || "Aizen Project";
  if (!idea) { sendJson(res,400,{success:false,error:"IDEA_REQUIRED",message:"فكرة المشروع مطلوبة"}); return; }
  const token = getBearerToken(req);
  try {
    const rows = await supabaseRequest("POST", "/rest/v1/projects", token, [{ user_id:user.id, name, type, description:idea, status:"building", updated_at:new Date().toISOString() }], {"Prefer":"return=representation"});
    const project = Array.isArray(rows) && rows[0];
    if (!project?.id) { sendJson(res,500,{success:false,error:"PROJECT_CREATE_FAILED",message:"تعذر إنشاء المشروع"}); return; }
    const plan = buildAgentPlan({request:idea, projectType:type});
    sendJson(res,202,{success:true,building:true,project_id:project.id,project,plan,message:"بدأ Aizen بناء المشروع فعلياً. يمكنك متابعة الملفات من مساحة المشروع."});
  } catch (error) {
    console.error("CREATE PROJECT ERROR:",error);
    sendJson(res,500,{success:false,error:"PROJECT_CREATE_FAILED",message:"تعذر إنشاء المشروع حالياً."});
  }
}`;
server = replaceRange(server, oldCreateStart, oldCreateEnd, newCreate + oldCreateEnd, "handleCreate");

server = server.replace(
  'roadmap_features: listFeatures(),',
  'roadmap_features: listFeatures(),\n      aizen_16_stage_roadmap: roadmapStatus(),'
);
server = server.replace(
  'if (method === "POST" && pathname === "/api/features") {',
  'if (method === "POST" && pathname === "/api/direct-link") { const user = await requireAuth(req, res); if (!user) return; await handleDirectLink(req, res, user); return; }\n\n  if (method === "POST" && pathname === "/api/agent/plan") { const user = await requireAuth(req, res); if (!user) return; await handleAgentPlan(req, res, user); return; }\n\n  if (method === "POST" && pathname === "/api/agent/verify") { const user = await requireAuth(req, res); if (!user) return; await handleAgentVerify(req, res, user); return; }\n\n  if (method === "POST" && pathname === "/api/agent/command-check") { const user = await requireAuth(req, res); if (!user) return; await handleSafeCommandCheck(req, res, user); return; }\n\n  if (method === "POST" && pathname === "/api/owner/self-improve") { const user = await requireAuth(req, res); if (!user) return; await handleOwnerSelfImprove(req, res, user); return; }\n\n  if (method === "POST" && pathname === "/api/features") {'
);

const interactionMarker = 'function start(){';
const interactionPatch = `function installAizenButtonFallbacks(){
  const selectors=[
    ["[data-aizen-action=\"build\"]",()=>call("openBuildTypeModal")],
    ["[data-aizen-action=\"send\"]",send],
    ["[data-aizen-action=\"newline\"]",()=>{ensureNewlineButton();getComposer()?.focus();}],
    ["[data-aizen-action=\"agent\"]",()=>call("openAgentModal")]
  ];
  for(const [selector,fn] of selectors){document.querySelectorAll(selector).forEach(el=>{if(el.dataset.aizenHardBound==="1")return;el.dataset.aizenHardBound="1";el.addEventListener("click",async e=>{if(el.disabled)return;e.preventDefault();e.stopImmediatePropagation();try{await fn();}catch(err){console.error("AIZEN HARD BUTTON",err);toast("تعذر تنفيذ الزر حالياً.");}},true);});}
}
`;
interaction = replaceOnce(interaction, interactionMarker, interactionPatch + interactionMarker, "fresh button fallback");
interaction = interaction.replace('bind();const observer=', 'bind();installAizenButtonFallbacks();const observer=');
interaction = interaction.replace('const observer=new MutationObserver(()=>{bind();linkify();});', 'const observer=new MutationObserver(()=>{bind();installAizenButtonFallbacks();linkify();});');

fs.writeFileSync(serverPath, server);
fs.writeFileSync(interactionPath, interaction);
console.log("Aizen integration patch applied successfully.");
