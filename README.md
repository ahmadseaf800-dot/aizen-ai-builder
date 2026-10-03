# Aizen AI Builder

Aizen AI Builder contains Aizen Core, the provider-neutral AI engine, coding agent and multi-agent pipeline.

## AizenSMP Dashboard AI

The backend exposes a private server-to-server endpoint:

`POST /api/dashboard-ai`

It is authenticated with the Render environment variable:

`AIZEN_DASHBOARD_SECRET`

The Dashboard sends live AizenSMP state to this endpoint. Aizen AI interprets Arabic/English natural language and returns a structured, validated intent. The Dashboard remains responsible for authorization and actual execution.

The endpoint never receives GitHub tokens, Minecraft credentials or other server secrets.
