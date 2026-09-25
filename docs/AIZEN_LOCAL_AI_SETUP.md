# Aizen Independent AI

Aizen is designed as a provider-neutral AI Builder. The `backend/aizen-core.js` layer contains Aizen identity, engineering knowledge, agent rules and security policy. The model itself is replaceable.

## Local model

`backend/aizen-local-agent.js` talks to any OpenAI-compatible self-hosted inference server.

Set:

```env
AI_PROVIDER=local
AIZEN_LOCAL_MODEL_URL=http://YOUR_MODEL_SERVER:PORT
AIZEN_LOCAL_MODEL_NAME=YOUR_MODEL
AIZEN_LOCAL_MODEL_TIMEOUT_MS=120000
AIZEN_LOCAL_MODEL_RETRIES=2
```

Compatible runtimes can include llama.cpp servers, vLLM, Ollama-compatible gateways, or another server exposing `/v1/chat/completions`.

## Important limitation

There is no artificial daily message counter in the local agent. This does **not** mean infinite physical capacity: the practical limit is the compute, memory, context window and concurrency of the machine running the model.

Aizen should use bounded conversation context and persistent storage instead of deleting old conversations or imposing a provider-specific daily quota.

## Aizen agent pipeline

```text
User request
   -> inspect
   -> plan
   -> edit
   -> review
   -> verify
   -> repair when needed
```

The existing `aizen-agent-orchestrator.js` implements the planner/developer/QA/repair pipeline. It must remain behind authenticated project ownership checks and must never receive raw secrets.

## Knowledge

Aizen's knowledge is maintained in `backend/aizen-core.js`. It is deliberately retrieval-ready instead of pretending that a static file contains all knowledge in the world. Current/factual information should be added through a source-backed knowledge layer later.

## Security

Never grant the model unrestricted operating-system access. Tool access should be explicit and allowlisted. File paths must remain inside the current project, environment secrets must stay outside model context, and destructive actions require server-side authorization.
