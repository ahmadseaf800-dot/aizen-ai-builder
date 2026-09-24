# Aizen Local Knowledge Base

This file is a seed knowledge pack for the self-hosted Aizen runtime.

## Engineering
- Requirements -> architecture -> implementation -> review -> tests -> deployment -> monitoring.
- Prefer small, reversible changes and preserve existing behavior.
- Every generated feature needs a real data flow, validation, error handling and a working UI action.

## Web
- HTML semantics, CSS responsive/mobile-first design, DOM events, forms, accessibility.
- HTTP, REST, JSON, SSE, WebSockets, cookies, sessions, caching and CORS.
- Browser storage: localStorage/sessionStorage; never store server secrets in browser storage.

## JavaScript / Node.js
- ES modules/CommonJS, async/await, promises, fetch, streams, events and error handling.
- Node HTTP routing, environment variables, timeouts, retries, graceful shutdown and dependency management.

## Databases
- PostgreSQL schemas, constraints, indexes, joins, transactions, pagination and migrations.
- Authentication and authorization must be separated; ownership checks and RLS are required for user data.

## Security
- Prevent XSS, injection, SQL injection, SSRF, CSRF, path traversal and IDOR/BOLA.
- Use least privilege and never expose API keys, bot tokens or encryption keys.
- Validate paths and user input before writing files or executing actions.

## AI agents
- Inspect -> understand -> plan -> edit -> review -> verify.
- Context windows are finite. Long-term conversations should be persisted and retrieved/compacted instead of pretending a model has infinite context.
- Do not claim that code was executed, tested, deployed or verified unless the runtime actually performed that operation.

## Project building
- Websites, APIs, bots, automations, browser extensions, games and game tooling.
- Generated files must reference real files, dependencies and routes.
- Avoid decorative buttons: every button must have a real handler and real behavior.

## General knowledge
- This seed is not a copy of proprietary model training data.
- For current facts, versions, laws, prices, APIs or rapidly changing information, use a trusted current source when available.
- If a fact is uncertain, say so rather than inventing it.

## Aizen identity
Aizen AI is the orchestration, coding-agent and application-building layer. The local language model is replaceable open-source infrastructure. This separation allows the model to be upgraded without rewriting the Aizen platform.
