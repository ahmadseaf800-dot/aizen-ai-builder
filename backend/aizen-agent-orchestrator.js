/**
 * Aizen Multi-Agent Orchestrator
 * Product Manager -> Developer -> QA -> optional repair.
 */
const {buildGuardrailPrompt,validateBoilerplateFiles}=require("./aizen-boilerplates");

function parseQa(text){
  const source=String(text||"").trim();
  try{return JSON.parse(source.replace(/^```json\s*/i,"").replace(/```$/,""));}catch{}
  const approved=/"?approved"?\s*:\s*true/i.test(source)&&!/"?approved"?\s*:\s*false/i.test(source);
  return {approved,issues:approved?[]:[source.slice(0,4000)]};
}

async function runMultiAgent({request,type,project,files,conversationContext,runAIToText,extractAgentFileBlocks,buildCoreInstruction,knowledge,capabilities}){
  const existing=String(files||"");
  const guardrails=buildGuardrailPrompt(type,existing);
  const context=[
    `PROJECT: ${String(project?.name||"")}`,
    `TYPE: ${String(type||"custom")}`,
    `DESCRIPTION: ${String(project?.description||"")}`,
    "CURRENT FILES:",existing,
    "CONVERSATION:",String(conversationContext||"").slice(-50000),
    "KNOWLEDGE:",String(knowledge||"").slice(0,60000),
    "CAPABILITIES:",String(capabilities||"").slice(0,30000)
  ].join("\n\n");

  const plan=await runAIToText([
    buildCoreInstruction({mode:"planner",isBuild:true,userRequest:request}),
    "ROLE: Product Manager / Software Architect AI.",
    "Create a concrete implementation plan for the request. Do not write source files.",
    "Return: requirements, assumptions, architecture, file plan, dependencies, data flow, risks and acceptance criteria.",
    guardrails,"REQUEST:",request,context
  ].join("\n\n"),true,[]);

  let developer=await runAIToText([
    buildCoreInstruction({mode:"builder",isBuild:true,userRequest:request}),
    "ROLE: Developer AI.",
    "Implement the approved plan. Output ONLY complete changed/new files using FILE: path followed by a fenced code block.",
    "Never output secrets. Never delete existing files unless explicitly requested.",
    guardrails,"PLAN:",plan,"REQUEST:",request,context
  ].join("\n\n"),true,[]);

  let generated=extractAgentFileBlocks(developer).filter(f=>!f.path.includes(".."));
  let contract=validateBoilerplateFiles(type,generated);
  let qa=await runAIToText([
    buildCoreInstruction({mode:"reviewer",isBuild:true,userRequest:request}),
    "ROLE: QA Engineer AI.",
    "Review the proposed files against the request, plan and guardrails.",
    "Check syntax-level consistency, imports, routes, state, security, required files and obvious integration failures.",
    "Return JSON only: {\"approved\":true|false,\"issues\":[\"...\"],\"tests\":[\"...\"]}.",
    "PLAN:",plan,"GUARDRAILS:",guardrails,"PROPOSED FILES:",generated.map(f=>`FILE: ${f.path}\n${f.content}`).join("\n\n"),
    "BOILERPLATE CHECK:",JSON.stringify(contract)
  ].join("\n\n"),true,[]);

  let qaResult=parseQa(qa);
  if(!contract.ok||!qaResult.approved){
    const repair=await runAIToText([
      buildCoreInstruction({mode:"debugger",isBuild:true,userRequest:request}),
      "ROLE: Senior Developer / Repair AI.",
      "Repair the proposed files using the QA findings. Output ONLY complete changed/new files in FILE blocks.",
      "Do not introduce unrelated changes. Keep all guardrails.",
      guardrails,"QA:",JSON.stringify(qaResult),"CONTRACT:",JSON.stringify(contract),
      "PROPOSED FILES:",generated.map(f=>`FILE: ${f.path}\n${f.content}`).join("\n\n")
    ].join("\n\n"),true,[]);
    developer=repair;
    generated=extractAgentFileBlocks(repair).filter(f=>!f.path.includes(".."));
    contract=validateBoilerplateFiles(type,generated);
    qa=await runAIToText([
      buildCoreInstruction({mode:"reviewer",isBuild:true,userRequest:request}),
      "ROLE: Final QA Engineer AI.",
      "Return JSON only: {\"approved\":true|false,\"issues\":[\"...\"],\"tests\":[\"...\"]}.",
      guardrails,"FILES:",generated.map(f=>`FILE: ${f.path}\n${f.content}`).join("\n\n"),"CONTRACT:",JSON.stringify(contract)
    ].join("\n\n"),true,[]);
    qaResult=parseQa(qa);
  }

  return {plan,files:generated,qa:qaResult,contract,stages:["product_manager","developer","qa",(!qaResult.approved||!contract.ok)?"repair":"approved"]};
}
module.exports={runMultiAgent};
