/**
 * Aizen Agent Runtime v1
 * Provider-neutral agent policy and context compaction.
 * The model is replaceable; Aizen owns the agent loop and project rules.
 */
const crypto = require("crypto");

const MAX_CONTEXT_CHARS = Number(process.env.AIZEN_AGENT_CONTEXT_CHARS || 120000);
const MAX_PROJECT_CHARS = Number(process.env.AIZEN_AGENT_PROJECT_CHARS || 180000);

const PIPELINE = Object.freeze([
  "inspect",
  "plan",
  "implement",
  "review",
  "verify"
]);

function stableId(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

function compactMessages(messages, limit = MAX_CONTEXT_CHARS) {
  const list = Array.isArray(messages) ? messages : [];
  let used = 0;
  const output = [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i] || {};
    const role = String(m.role || "user").slice(0, 30);
    const content = String(m.content || "");
    const row = `${role}: ${content}`;
    if (used + row.length > limit && output.length) break;
    output.unshift(row.slice(0, Math.max(0, limit - used)));
    used += row.length;
    if (used >= limit) break;
  }
  return output.join("\n");
}

function compactProject(files, limit = MAX_PROJECT_CHARS) {
  const list = Array.isArray(files) ? files : [];
  const rows = [];
  let used = 0;
  for (const file of list) {
    const p = String(file?.path || "");
    const c = String(file?.content || "");
    const row = `FILE ${p}\n${c}`;
    if (used + row.length > limit && rows.length) break;
    rows.push(row.slice(0, Math.max(0, limit - used)));
    used += row.length;
    if (used >= limit) break;
  }
  return rows.join("\n\n");
}

function buildAgentContext({ request, messages, files, mode = "assistant" } = {}) {
  return {
    agent_id: stableId(`${mode}:${request}`),
    mode,
    pipeline: PIPELINE,
    request: String(request || "").slice(0, 500000),
    conversation: compactMessages(messages),
    project: compactProject(files),
    rules: [
      "Inspect before changing.",
      "Preserve existing behavior unless the user explicitly requests a breaking change.",
      "Every UI action must have a real handler and real data flow.",
      "Never expose environment secrets or bot tokens to the model.",
      "Never claim execution, testing or deployment unless the runtime actually did it.",
      "Prefer small, reversible edits.",
      "Review syntax, imports, routes, state, security and mobile UX before finishing."
    ]
  };
}

module.exports = { PIPELINE, compactMessages, compactProject, buildAgentContext, stableId };
