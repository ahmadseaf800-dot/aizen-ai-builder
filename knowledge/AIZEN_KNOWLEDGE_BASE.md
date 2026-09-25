# Aizen Knowledge Base

This directory is a retrieval-ready knowledge layer for Aizen. It is intentionally maintained separately from the model so knowledge can be updated without retraining the model.

## Core domains

- Software engineering: architecture, APIs, databases, testing, debugging, performance and maintainability.
- Web: HTML, CSS, JavaScript, HTTP, REST, WebSockets, accessibility, responsive UI and security.
- Backend: Node.js, Python, Java, Go, Rust, PHP, C#, SQL and common service patterns.
- Data: PostgreSQL, Supabase, migrations, constraints, indexes, transactions, pagination and RLS.
- AI engineering: context windows, streaming, structured output, tool calling, RAG, embeddings, evaluation and local inference.
- Security: authentication, authorization, XSS, CSRF, SSRF, injection, path traversal, secret handling and secure defaults.
- Bots: Telegram, Discord, webhooks, token verification and rate-limit aware design.
- Games: Minecraft Java/Fabric/Paper/Purpur concepts, Unity, Unreal and Godot concepts.
- Deployment: Docker, environment variables, health checks, logs, CI/CD and reverse proxies.

## Knowledge policy

1. Stable technical knowledge can live in this repository.
2. Fast-changing facts must be refreshed from a trusted source before being treated as current.
3. Do not copy copyrighted books, private datasets or proprietary model weights into this repository.
4. Store source URL, title, publisher and retrieval date when adding external facts.
5. Never store API keys, bot tokens, passwords or user secrets in the knowledge base.

## Retrieval format

Each future document should use:

- `title`
- `domain`
- `source`
- `retrieved_at`
- `content`
- `tags`

The backend can later chunk these documents and index them for project-aware RAG.

## Aizen identity

Aizen AI is the AI system inside Aizen AI Builder. It is an independently orchestrated product layer and is not a copy of ChatGPT or another provider's proprietary model.

## Message limits

Aizen itself does not impose a fake daily message quota. Actual throughput is limited by the selected inference server, hardware, model context and deployment resources. A local model removes dependence on a third-party provider's daily quota, but it does not create literally infinite compute.
