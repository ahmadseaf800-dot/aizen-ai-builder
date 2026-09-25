# Aizen Knowledge Architecture v1

Aizen does not pretend that a finite model contains every fact in the world. Instead it uses a layered knowledge system.

## Layers

1. **Core rules** — stable engineering, security and product behavior.
2. **Project memory** — the user's project structure, decisions and verified history.
3. **Documentation knowledge** — curated technical documentation that can be updated.
4. **Retrieval knowledge** — indexed documents/chunks retrieved only when relevant.
5. **Current information** — fetched from trusted sources when freshness matters.

## Agent behavior

The agent should retrieve relevant knowledge before answering specialized questions, cite or identify the source when appropriate, and never invent missing facts.

## Unlimited conversations

Aizen may store an unbounded number of message rows subject to database/storage limits. The model still has a finite context window. Therefore the agent uses recent messages, summaries and retrieval instead of sending every historical message on every request.

## Builder knowledge domains

- Web: HTML, CSS, JavaScript, TypeScript, HTTP, REST, WebSockets, accessibility and responsive design.
- Backend: Node.js, Python, Go, Java, APIs, queues, caching and background jobs.
- Databases: PostgreSQL, SQL, migrations, indexes, transactions, ownership and RLS.
- AI: model APIs, local inference, structured output, agents, RAG, embeddings, evaluation and safety.
- Apps: authentication, state management, networking, storage, notifications and deployment.
- Bots: Telegram, Discord, webhooks, rate limits and secure token handling.
- Games: common Unity, Unreal, Godot and Minecraft development concepts.
- DevOps: Docker, health checks, environment configuration, CI/CD, logs and monitoring.

This document is an architecture specification, not a copy of proprietary model weights or private training data.
