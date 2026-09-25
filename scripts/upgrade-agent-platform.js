const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const serverPath=path.join(root,'backend','server.js');
let s=fs.readFileSync(serverPath,'utf8');
const importAnchor='const { listFeatures, buildPlannerPrompt, buildSecurityPrompt, buildTestPrompt, validateAgentAction } = require("./aizen-feature-engine");';
if(!s.includes(importAnchor))throw new Error('server import anchor not found');
if(!s.includes('aizen-agent-orchestrator'))s=s.replace(importAnchor,importAnchor+'\nconst { runMultiAgent } = require("./aizen-agent-orchestrator");\nconst { getBoilerplate, buildGuardrailPrompt } = require("./aizen-boilerplates");');
const handlerAnchor='async function handleAizenFeature(req,res,user){';
if(!s.includes(handlerAnchor))throw new Error('feature handler anchor not found');
if(!s.includes('async function handleMultiAgentPipeline')){
const handler=`async function handleMultiAgentPipeline(req,res,user){
  let data;
  try{data=await readJsonBody(req,res,3*1024*1024);}catch(error){sendJson(res,400,{success:false,error:"INVALID_JSON",message:"البيانات المرسلة غير صحيحة"});return;}
  const projectId=String(data.projectId||"").trim(), conversationId=String(data.conversationId||"").trim(), request=String(data.instruction||data.request||"").trim();
  if(!projectId||!request){sendJson(res,400,{success:false,error:"AGENT_PIPELINE_FIELDS_REQUIRED",message:"المشروع والطلب مطلوبان"});return;}
  const token=getBearerToken(req);
  try{
    const rows=await supabaseRequest("GET","/rest/v1/projects?id=eq."+encodeURIComponent(projectId)+"&user_id=eq."+encodeURIComponent(user.id)+"&select=id,name,type,description,status&limit=1",token);
    if(!Array.isArray(rows)||!rows.length){sendJson(res,404,{success:false,error:"PROJECT_NOT_FOUND",message:"المشروع غير موجود أو لا تملك صلاحية الوصول إليه"});return;}
    const project=rows[0];
    const projectFiles=await supabaseRequest("GET","/rest/v1/project_files?project_id=eq."+encodeURIComponent(projectId)+"&user_id=eq."+encodeURIComponent(user.id)+"&select=path,content,file_type,size_bytes&order=path.asc&limit=500",token);
    const files=Array.isArray(projectFiles)?projectFiles:[];
    let conversationContext="";
    if(conversationId){try{const messages=await getConversationMessages(token,conversationId);conversationContext=messages.slice(-50).map(m=>"["+(m.role==="assistant"?"AIZEN":"USER")+"]\\n"+String(m.content||"")).join("\\n\\n").slice(-60000);}catch{}}
    const result=await runMultiAgent({request,type:project.type||"custom",project,files:compactProjectFiles(files,180000),conversationContext,runAIToText,extractAgentFileBlocks,buildCoreInstruction:buildAizenCoreInstruction,knowledge:AIZEN_CORE_KNOWLEDGE,capabilities:AIZEN_AGENT_CAPABILITIES});
    if(!result.files.length){sendJson(res,422,{success:false,error:"AGENT_PIPELINE_NO_FILES",message:"لم ينتج الوكلاء ملفات قابلة للتطبيق.",stages:result.stages,qa:result.qa});return;}
    if(!result.contract.ok||!result.qa.approved){sendJson(res,422,{success:false,error:"AGENT_PIPELINE_QA_FAILED",message:"رفض وكيل QA تطبيق التغييرات حتى لا ينكسر المشروع.",stages:result.stages,issues:result.contract.issues.concat(result.qa.issues||[]),files:result.files.map(f=>f.path)});return;}
    const rowsToSave=result.files.map(file=>({project_id:projectId,user_id:user.id,path:file.path,content:file.content,file_type:file.file_type,size_bytes:file.size_bytes,updated_at:new Date().toISOString()}));
    const saved=await supabaseRequest("POST","/rest/v1/project_files?on_conflict=project_id%2Cpath",token,rowsToSave,{"Prefer":"resolution=merge-duplicates,return=representation"});
    await supabaseRequest("PATCH","/rest/v1/projects?id=eq."+encodeURIComponent(projectId)+"&user_id=eq."+encodeURIComponent(user.id),token,{status:"ready",updated_at:new Date().toISOString()});
    sendJson(res,200,{success:true,changed:result.files.length,files:result.files.map(f=>f.path),stages:result.stages,qa:result.qa,boilerplate:project.type||"custom",saved:Array.isArray(saved)?saved.length:result.files.length});
  }catch(error){console.error("MULTI AGENT PIPELINE ERROR:",error);if(!res.headersSent)sendJson(res,500,{success:false,error:"AGENT_PIPELINE_ERROR",message:"تعذر تشغيل فريق Aizen AI. لم يتم تطبيق أي ملف."});}
}

`;
s=s.replace(handlerAnchor,handler+handlerAnchor);
}
const routeNeedle='if (method === "POST" && pathname === "/api/agent") {';
if(!s.includes(routeNeedle))throw new Error('agent route anchor not found');
if(!s.includes('await handleMultiAgentPipeline(req, res, user);'))s=s.replace('await handleCodingAgent(req, res, user);','await handleMultiAgentPipeline(req, res, user);');
const interactionAnchor='  /*\n   * Independent frontend interaction layer\n   */';
if(!s.includes(interactionAnchor))throw new Error('interaction anchor not found');
const previewRoute=`  /*\n   * Browser Live Preview engine\n   */\n  if (method === "GET" && pathname === "/aizen-preview.js") {\n    fs.readFile(path.join(__dirname, "..", "frontend", "aizen-preview.js"), (error, content) => {\n      if (error) { sendJson(res,500,{success:false,error:"PREVIEW_SCRIPT_NOT_FOUND"}); return; }\n      res.writeHead(200,{"Content-Type":"application/javascript; charset=utf-8","Cache-Control":"no-cache"});\n      res.end(content);\n    });\n    return;\n  }\n\n`;
if(!s.includes('/aizen-preview.js'))s=s.replace(interactionAnchor,previewRoute+interactionAnchor);
s=s.replace('res.writeHead(200, {\n        "Content-Type": "text/html; charset=utf-8",\n        "Cache-Control": "no-cache",\n      });','res.writeHead(200, {\n        "Content-Type": "text/html; charset=utf-8",\n        "Cache-Control": "no-cache",\n        "Cross-Origin-Opener-Policy": "same-origin",\n        "Cross-Origin-Embedder-Policy": "credentialless",\n      });');
const oldBlock=`const enhanced = html.includes("/interaction.js")\n        ? html\n        : html.replace(/<\\/body>/i, '<script src="/interaction.js" defer></script></body>');`;
if(s.includes(oldBlock)&&!s.includes('aizen-preview.js')){
  const newBlock=`let enhanced = html.includes("/interaction.js") ? html : html.replace(/<\\/body>/i, '<script src="/interaction.js" defer></script></body>');\n      if(!enhanced.includes("/aizen-preview.js")) enhanced=enhanced.replace(/<\\/body>/i,'<script src="/aizen-preview.js" defer></script></body>');`;
  s=s.replace(oldBlock,newBlock);
}
fs.writeFileSync(serverPath,s);
console.log('Aizen platform upgrade patched server.js');
