# Aizen Local AI Runtime

Aizen Core is provider-neutral. This runtime lets Aizen use a self-hosted open-source language model instead of Gemini, Groq, or OpenRouter.

## Recommended local stack

Run an OpenAI-compatible local model server such as Ollama on a machine/server with enough RAM/VRAM.

Example:
```bash
ollama pull qwen2.5-coder:7b
ollama serve
```

Then configure Aizen Backend:

```
AI_PROVIDER=local
AIZEN_LOCAL_MODEL_URL=http://YOUR_MODEL_SERVER:11434/v1
AIZEN_LOCAL_MODEL_NAME=qwen2.5-coder:7b
AIZEN_LOCAL_ONLY=true
```

The backend sends the Aizen system/agent instructions and conversation context to the local model. The browser never receives the model server credentials.

## Important

Aizen Core is the orchestration, memory, knowledge, coding-agent, security and project-building layer. It is not a copy of ChatGPT's private model weights or training data.

The model itself must be supplied by the deployment. Model weights are intentionally not stored in GitHub.

## Message history

All conversation messages remain stored in the application's database. The AI request uses a bounded context window because every language model has a finite context size. This does not impose a lifetime message-count limit on the conversation database.

## Safety

The local model is not given raw environment secrets. Project ownership is checked through the authenticated Supabase session before the coding agent reads or writes project files.
