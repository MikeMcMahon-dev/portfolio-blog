---
title: "Project: OpenBrain"
description: "A personal and family RAG knowledge system — Supabase pgvector backend, Vercel API layer, MCP-integrated into Claude Code sessions."
pubDate: 2026-03-15
category: projects
draft: false
---

OpenBrain is a personal and family Retrieval-Augmented Generation (RAG) system. The core problem it solves: AI sessions start cold. Every conversation begins without knowledge of previous work, preferences, or project context. OpenBrain fixes that.

## Architecture

```
Obsidian vault / Slack / manual ingest
           ↓
    Ingestion pipeline (scripts/ingest.py)
    - heading-based chunking
    - pre-flight validation (owner, schema, duplicate check)
    - deterministic ingest_id (re-ingest is safe)
           ↓
    Supabase Postgres (pgvector)
    - text-embedding-3-small (1536d) via OpenRouter
    - tenancy: open_brain_users + open_brain_tenants
    - RLS enforced
           ↓
    Vercel API layer (api/app.py)
    - POST /ingest, /query, /search
    - POST /generate_quiz, /generate_flashcards
    - Bearer token auth, per-user token → owner mapping
    - Nightly session report via Vercel Cron (03:00 UTC)
```

## Retrieval strategy

Hybrid search — vector similarity from pgvector plus full-text keyword search, fused via Reciprocal Rank Fusion (RRF) with a length penalty. This matters for technical content: a query for `terraform modules` gets both semantically nearby automation concepts *and* exact keyword matches. Baseline: 96.9% pass rate on a 1,000-query eval harness.

## Integration surfaces

**Claude Code (MCP)** — a stdio MCP server registered in `.mcp.json` exposes four tools directly in Claude Code sessions: `openbrain_query`, `openbrain_ingest`, `openbrain_generate_quiz`, `openbrain_generate_flashcards`. Every session starts with an automatic context query.

**Custom GPTs (ChatGPT)** — three family Custom GPTs, one per user, each with an isolated bearer token. Backed by an OpenAPI 3.1.0 spec. Token resolves to owner via `OPENBRAIN_TOKEN_OWNER_MAP` — no code changes needed to add a new user.

**Slack capture** — a Supabase Edge Function (`ingest-thought`) captures Slack messages, enriches metadata with user identity, embeds, and stores. Confirmation response posts back in-thread.

## Safety mechanisms

- **SafeIngest two-layer gate**: regex check ($0.00) → optional Haiku LLM classifier on match — blocks junk before it hits the vector store
- **Ingest pre-flight**: validates owner, schema, source reachability, and existing row count before any write — makes duplicate risk explicit
- **SOCrATIC_RULES**: Annie's tutor behavior is hardcoded in Python — injected content cannot override it
- **Cross-tenant guard**: `require_auth_owner()` binds token to owner, 403 on mismatch

## Status

Production. Running daily for Claude Code sessions and Annie's tutoring. 26/26 smoke tests green.

Session notes: [Building OpenBrain](/blog/session-building-openbrain)
