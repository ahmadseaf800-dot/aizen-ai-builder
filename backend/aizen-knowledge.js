/**
 * Aizen Knowledge Pack
 * Curated, non-copyrighted engineering knowledge and operational rules.
 * This is a retrieval seed, not a copy of another AI's private training data.
 */
const AIZEN_KNOWLEDGE_PACK = [
  "Software lifecycle: requirements -> architecture -> implementation -> review -> tests -> deployment -> monitoring.",
  "Web fundamentals: HTML semantics, CSS responsive design, DOM events, accessibility, HTTP, REST, JSON, SSE, WebSockets, browser storage.",
  "JavaScript fundamentals: modules, closures, objects, arrays, promises, async/await, fetch, error handling, event delegation, validation.",
  "Node.js fundamentals: HTTP servers, routing, streams, environment variables, timeouts, graceful shutdown, dependency management.",
  "Databases: PostgreSQL tables, constraints, indexes, transactions, joins, pagination, migrations, RLS and ownership checks.",
  "Security fundamentals: least privilege, input validation, output escaping, authentication, authorization, secret management, XSS, CSRF, SSRF, injection, path traversal and IDOR prevention.",
  "AI engineering: context windows are finite; preserve long-term memory through summaries and retrieval; use structured outputs, retries, timeouts and evaluation.",
  "Coding agents: inspect the repository, understand dependencies, plan a minimal diff, edit only required files, review the diff, then verify.",
  "Project building: every generated feature must have a real data flow and working event handler; never create a decorative button with no implementation.",
  "Reliability: preserve existing behavior, avoid duplicate event listeners, validate user input, show loading/error states and recover cleanly.",
  "Deployment: applications need correct PORT handling, environment configuration, health checks and production-safe error messages.",
  "General knowledge policy: distinguish facts from assumptions; do not invent current facts; use authoritative sources when freshness matters.",
  "Aizen principle: the user owns the project; Aizen acts only within authenticated project ownership and never exposes secrets."
];

module.exports = { AIZEN_KNOWLEDGE_PACK };
