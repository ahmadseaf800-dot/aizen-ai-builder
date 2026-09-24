# Aizen Local AI Runtime

Aizen Core is the orchestration layer; the language model is an open-source model hosted by you. This avoids depending on Gemini/Groq/OpenRouter when local mode is enabled.

## Docker / Ollama

From `aizen-local-runtime/`:

```bash
docker compose up -d
```

The compose file pulls `qwen2.5-coder:3b` and creates the local model alias `aizen-local` from the repository Modelfile.

Backend environment:

```
AI_PROVIDER=local
AIZEN_LOCAL_MODEL_URL=http://YOUR_MODEL_SERVER:11434/v1
AIZEN_LOCAL_MODEL_NAME=aizen-local
AIZEN_LOCAL_ONLY=true
```

For the same machine, use `http://127.0.0.1:11434/v1`. If the backend is on another server, expose Ollama only through a private network or authenticated proxy.

## What is independent

Aizen Core provides identity, coding-agent orchestration, project context, knowledge rules, file validation, review instructions and workspace tooling. The local model supplies language generation.

Model weights and another AI's private training data are not copied into GitHub. The local model is downloaded by the runtime.

## Long conversations

The database can store an unbounded number of conversation rows subject to database/storage limits. A model still has a finite context window, so the backend intentionally sends bounded recent context. This prevents old messages from crashing every request.

## Workspace

The authenticated workspace API supports project file listing, safe file writes/deletes and deterministic JavaScript/JSON/security checks. It never exposes environment secrets or permits path traversal.

## Reliability

The repository includes a GitHub Actions syntax guard for the backend. Existing external-provider fallback remains available when `AI_PROVIDER=auto` is used.
