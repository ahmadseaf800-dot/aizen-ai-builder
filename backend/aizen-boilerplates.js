/**
 * Aizen Guarded Boilerplates
 * Stable contracts that constrain generated projects to known-good structures.
 */
const path = require("path");

const BOILERPLATES = Object.freeze({
  website: {
    id:"website",
    label:"موقع ويب آمن",
    required:["package.json","src/","public/"],
    rules:[
      "Keep application code under src and static assets under public.",
      "Use environment variables for secrets; never hard-code credentials.",
      "Keep client and server responsibilities separated when a backend is required.",
      "Provide a working start/build script in package.json."
    ]
  },
  app: {
    id:"app", label:"تطبيق ويب", required:["package.json","src/"],
    rules:["Use a clear src structure.","Keep configuration in environment variables.","Include loading, error and empty states."]
  },
  telegram_bot: {
    id:"telegram_bot", label:"Telegram Bot", required:["package.json","src/"],
    rules:["Read TELEGRAM_BOT_TOKEN only from process.env.","Never log the token.","Separate command handlers from startup.","Handle API errors without crashing the process."]
  },
  discord_bot: {
    id:"discord_bot", label:"Discord Bot", required:["package.json","src/"],
    rules:["Read DISCORD_BOT_TOKEN only from process.env.","Never log the token.","Keep intents and permissions explicit.","Handle login/API errors safely."]
  },
  game: {
    id:"game", label:"لعبة ويب", required:["package.json","src/"],
    rules:["Keep game loop/state separate from rendering/UI.","Handle resize and mobile input.","Avoid blocking the main thread for long operations."]
  },
  browser_extension: {
    id:"browser_extension", label:"إضافة للمتصفح", required:["manifest.json","src/"],
    rules:["Use a valid Manifest V3 structure.","Request only necessary permissions.","Keep secrets out of extension source."]
  },
  api: {
    id:"api", label:"API / Backend", required:["package.json","src/"],
    rules:["Validate input at the boundary.","Centralize error handling.","Never expose secrets in responses."]
  },
  game_mod: {
    id:"game_mod", label:"إضافة للألعاب", required:[],
    rules:["Respect the selected game and loader/version.","Do not invent APIs; keep version-specific code isolated.","Document build commands and required dependencies."]
  },
  automation: {
    id:"automation", label:"أتمتة", required:["README.md"],
    rules:["Make retries bounded and safe.","Keep credentials in environment variables.","Log useful events without secrets."]
  },
  custom: {
    id:"custom", label:"مشروع مخصص", required:[],
    rules:["Choose the smallest coherent architecture.","Do not add unnecessary dependencies.","Preserve existing project behavior."]
  }
});

function getBoilerplate(type){return BOILERPLATES[String(type||"").trim()]||BOILERPLATES.custom;}
function buildGuardrailPrompt(type, existingFiles=""){
  const b=getBoilerplate(type);
  return [
    "AIZEN GUARDED BOILERPLATE CONTRACT",
    `Template: ${b.label} (${b.id})`,
    `Required structure: ${b.required.length?b.required.join(", "):"Choose a documented structure appropriate to the project."}`,
    "Immutable rules:",
    ...b.rules.map((r,i)=>`${i+1}. ${r}`),
    "Never delete an existing working file unless the user explicitly requests deletion.",
    "Do not write outside the project root. Do not create .env, private keys, or credential files.",
    "Generated changes must fit the existing architecture instead of replacing it with an unrelated stack.",
    "Existing project snapshot:",
    String(existingFiles||"").slice(0,120000)
  ].join("\n");
}
function validateBoilerplateFiles(type, files){
  const b=getBoilerplate(type), list=Array.isArray(files)?files:[], issues=[];
  for(const required of b.required){
    if(required.endsWith("/")){if(!list.some(f=>String(f?.path||"").startsWith(required)))issues.push(`Missing required directory: ${required}`);}
    else if(!list.some(f=>String(f?.path||"")===required))issues.push(`Missing required file: ${required}`);
  }
  for(const file of list){
    const p=String(file?.path||""), c=String(file?.content||"");
    if(p===".env"||p.startsWith(".env."))issues.push("Environment secret files are forbidden in generated output.");
    if(/(?:TELEGRAM_BOT_TOKEN|DISCORD_BOT_TOKEN|API_KEY|SECRET_KEY)\s*=\s*["'][^"']+["']/i.test(c))issues.push(`Possible hard-coded secret in ${p}.`);
  }
  return {ok:issues.length===0,issues};
}
module.exports={BOILERPLATES,getBoilerplate,buildGuardrailPrompt,validateBoilerplateFiles};
