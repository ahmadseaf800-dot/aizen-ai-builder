# تشغيل Aizen AI محلياً

Aizen AI Builder now has a provider-neutral local inference path. The application does not contain proprietary ChatGPT/Gemini/Groq weights; instead it can connect to a self-hosted open-source model through an OpenAI-compatible endpoint.

## Environment

```env
AI_PROVIDER=auto
AIZEN_LOCAL_MODEL_URL=http://localhost:11434/v1
AIZEN_LOCAL_MODEL_NAME=qwen2.5-coder:7b
AIZEN_LOCAL_ONLY=false
```

With `AIZEN_LOCAL_ONLY=true`, Aizen does not fall back to third-party providers.

## Ollama example

```bash
ollama serve
ollama pull qwen2.5-coder:7b
```

Then point `AIZEN_LOCAL_MODEL_URL` at the Ollama OpenAI-compatible endpoint.

## What is independent

The Aizen layer owns:

- system instructions and identity
- project memory and conversation context
- planner/developer/QA/repair orchestration
- workspace analysis
- security guardrails
- knowledge retrieval structure
- provider routing and fallback policy
- message persistence
- project file management

The underlying model remains a replaceable component. A model must still run somewhere; no software architecture can make compute literally infinite or remove hardware/resource limits.

## Knowledge

`knowledge/AIZEN_KNOWLEDGE_BASE.md` is a retrieval-ready starter. Add source-backed documents there or connect a vector database later. Do not put private credentials, copyrighted bulk datasets, or secret user information into the repository.

## Safety

The coding agent should receive project-scoped tools rather than unrestricted server access. Secrets stay outside model context. Owner/admin authorization must always be checked by the backend.
