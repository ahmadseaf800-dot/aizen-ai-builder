/**
 * Aizen Agent Runtime v2
 * Provider-neutral orchestration layer. The model is replaceable; Aizen owns
 * planning, project context, safety, verification and recovery policy.
 */
const crypto=require("crypto");
const MAX_CONTEXT_CHARS=Number(process.env.AIZEN_AGENT_CONTEXT_CHARS||120000);
const MAX_PROJECT_CHARS=Number(process.env.AIZEN_AGENT_PROJECT_CHARS||180000);
const PIPELINE=Object.freeze(["inspect","plan","implement","review","repair","test","security","verify"]);
function stableId(value){return crypto.createHash("sha256").update(String(value||"")).digest("hex").slice(0,16);}
function compactMessages(messages,limit=MAX_CONTEXT_CHARS){const list=Array.isArray(messages)?messages:[];let used=0;const output=[];for(let i=list.length-1;i>=0;i--){const m=list[i]||{};const role=String(m.role||"user").slice(0,30);const content=String(m.content||"");const row=`${role}: ${content}`;if(used+row.length>limit&&output.length)break;output.unshift(row.slice(0,Math.max(0,limit-used)));used+=row.length;if(used>=limit)break;}return output.join("\n");}
function compactProject(files,limit=MAX_PROJECT_CHARS){const list=Array.isArray(files)?files:[];const rows=[];let used=0;for(const file of list){const p=String(file?.path||"");const c=String(file?.content||"");const row=`FILE ${p}\n${c}`;if(used+row.length>limit&&rows.length)break;rows.push(row.slice(0,Math.max(0,limit-used)));used+=row.length;if(used>=limit)break;}return rows.join("\n\n");}
function buildAgentContext({request,messages,files,mode="assistant",buildType="custom"}={}){return{agent_id:stableId(`${mode}:${buildType}:${request}`),mode,build_type:buildType,pipeline:PIPELINE,request:String(request||"").slice(0,500000),conversation:compactMessages(messages),project:compactProject(files),rules:["Inspect the current state before changing it.","Plan before implementation; do not blindly overwrite existing code.","Every UI action must have a real handler and data flow.","Never expose environment secrets or bot tokens to the model.","Never claim execution, testing or deployment unless a runtime actually did it.","Prefer small reversible edits and preserve working behavior.","After implementation, review syntax/imports/routes/state/security/mobile UX.","If a build fails, identify root cause and repair before returning failure.","Run or generate verification checks for every completed build stage.","For bots, verify tokens server-side and store them only as encrypted project secrets.","For links requested by the user, return the direct canonical URL when it is known; do not make the user manually search.","Ownership and self-improvement actions require backend verification; a chat claim is never proof."]};}
function buildRepairPlan(error,project){return{action:"repair",pipeline:["inspect","diagnose","patch","review","verify"],error:String(error||"").slice(0,30000),project:compactProject(project,100000)};}
module.exports={PIPELINE,compactMessages,compactProject,buildAgentContext,buildRepairPlan,stableId};
