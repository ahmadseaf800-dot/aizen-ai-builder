# Aizen AI — Independent Local Model

Aizen Core is provider-neutral. The application does **not** need to be permanently tied to Gemini, Groq, or OpenRouter.

## Architecture

```text
Aizen UI
  -> Aizen Backend
      -> Aizen Core (identity, memory policy, agent rules, security)
      -> Local OpenAI-compatible model endpoint
      -> Project tools / Supabase / workspace
```

The model endpoint only provides inference. Aizen Core remains responsible for the product behavior, project workflow, memory policy, security rules, and builder instructions.

## Environment

```env
AI_PROVIDER=local
AIZEN_LOCAL_MODEL_URL=http://YOUR_MODEL_SERVER/v1
AIZEN_LOCAL_MODEL_NAME=YOUR_MODEL_NAME
AIZEN_LOCAL_ONLY=true
```

The endpoint must implement an OpenAI-compatible chat-completions route:

```text
POST /chat/completions
Content-Type: application/json

{
  "model": "YOUR_MODEL_NAME",
  "stream": true,
  "messages": [
    {"role":"system","content":"..."},
    {"role":"user","content":"..."}
  ]
}
```

## Important limitation

Aizen cannot become an unlimited, self-trained frontier model simply by adding JavaScript files. A real independent model requires model weights and compute. This repository provides the **Aizen intelligence/orchestration layer and local-model adapter** so a suitable open model can be connected without changing the product architecture.

Message storage is independent from inference limits: conversations can be persisted in the database, while the model receives a bounded context assembled by Aizen. This prevents an ever-growing chat history from crashing inference.

## Safety

- Never place API keys or bot tokens in model prompts.
- Local model access must be server-side.
- Project tools must enforce authenticated ownership.
- Never give the model unrestricted access to the host filesystem.
- Validate project paths before reads/writes.
- Keep environment secrets outside Git.
