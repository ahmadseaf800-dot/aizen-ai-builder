/**
 * Aizen Workspace Engine
 * Real project tools used by the Coding Agent and workspace UI.
 */
const path = require("path");

const MAX_FILE_CHARS = Number(process.env.AIZEN_MAX_FILE_CHARS || 500000);
const MAX_FILES = Number(process.env.AIZEN_MAX_FILES || 2000);
const BLOCKED = new Set([".env",".env.local",".env.production",".env.development","id_rsa","id_ed25519",".npmrc"]);

function cleanProjectPath(value){
  let p=String(value||"").trim().replace(/\\/g,"/");
  p=p.replace(/^\/+/,"");
  if(!p || p.length>240 || p.includes("\0")) return null;
  const normalized=path.posix.normalize(p);
  if(normalized==="." || normalized.startsWith("../") || normalized.includes("/../") || normalized.startsWith(".git/")) return null;
  const base=normalized.split("/").pop().toLowerCase();
  if(BLOCKED.has(base) || /\.(pem|key|p12|pfx)$/i.test(base)) return null;
  return normalized;
}
function validateContent(content){
  const value=String(content??"");
  if(value.length>MAX_FILE_CHARS) throw new Error("FILE_TOO_LARGE");
  return value;
}
function fileType(filePath){
  const ext=path.posix.extname(filePath).slice(1).toLowerCase();
  return ext || "text";
}
function makeFileRow(projectId,userId,filePath,content){
  const safe=cleanProjectPath(filePath);
  if(!safe) throw new Error("INVALID_FILE_PATH");
  const value=validateContent(content);
  return {project_id:projectId,user_id:userId,path:safe,content:value,file_type:fileType(safe),size_bytes:Buffer.byteLength(value,"utf8"),updated_at:new Date().toISOString()};
}
function staticCheck(file){
  const p=String(file?.path||""), c=String(file?.content||""), issues=[];
  try{if(/\.json$/i.test(p)) JSON.parse(c);}catch(e){issues.push("JSON syntax: "+e.message);}
  if(/\.(js|mjs|cjs)$/i.test(p)){try{new Function(c);}catch(e){issues.push("JavaScript syntax: "+e.message);}}
  if(/process\.env\.[A-Z0-9_]+\s*=\s*["'][^"']+["']/i.test(c)) issues.push("Possible hard-coded environment secret.");
  return {path:p,ok:issues.length===0,issues};
}
function securityCheck(file){
  const c=String(file?.content||""),p=String(file?.path||""),findings=[];
  const rules=[
    [/innerHTML\s*=/i,"Review innerHTML assignment for XSS."],
    [/eval\s*\(/i,"Avoid eval in application code."],
    [/child_process|execSync\s*\(|spawnSync\s*\(/i,"Review command execution and input validation."],
    [/SELECT\s+.+\+\s*["']/i,"Possible SQL string concatenation."],
    [/(api[_-]?key|token|secret|password)\s*[:=]\s*["'][^"']{8,}["']/i,"Possible hard-coded secret."]
  ];
  for(const [re,msg] of rules) if(re.test(c)) findings.push(msg);
  return {path:p,findings};
}
function analyzeFiles(files){
  const list=Array.isArray(files)?files.slice(0,MAX_FILES):[];
  const checks=list.map(staticCheck), security=list.map(securityCheck).filter(x=>x.findings.length), dependencies=new Set();
  for(const f of list){
    const c=String(f?.content||"");
    for(const m of c.matchAll(/(?:require\(|from\s+|import\s+)(["'])([^"']+)\1/g)){
      const name=m[2]; if(name&&!name.startsWith(".")&&!name.startsWith("/")) dependencies.add(name);
    }
  }
  return {files:list.length,syntax_ok:checks.every(x=>x.ok),checks,security,dependencies:[...dependencies].sort(),generated_at:new Date().toISOString()};
}
module.exports={MAX_FILE_CHARS,MAX_FILES,cleanProjectPath,validateContent,makeFileRow,staticCheck,securityCheck,analyzeFiles};
