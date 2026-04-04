---
title: "Building OpenBrain: A Personal RAG Knowledge System"
description: "Standing up a Retrieval-Augmented Generation system backed by Supabase pgvector, hosted on Vercel, and wired into Claude Code sessions via MCP."
pubDate: 2026-03-15
category: sessions
draft: false
---

Every AI session starts cold. The model has no memory of what you built yesterday, what decisions you made last week, or why you chose that architecture over the other one. The standard answer is "paste your context in at the start of every session." That doesn't scale.

OpenBrain is the fix. Ingest context once. Query it on demand. Every session starts warm.

---

## Why Supabase (and Why ChromaDB Was Never Going to Work)

The first architectural decision was the vector store. ChatGPT suggested ChromaDB — local, embedded, easy to stand up. It worked fine for a single-user local prototype. The moment the requirements changed, it didn't.

The requirements changed immediately: multi-user (Mike, Beth, Annie), agentic updates from Claude Code sessions, web-based ingest from Custom GPTs. ChromaDB is local-first. It has no web-facing API, no multi-user tenancy model, no path to Vercel. The second those needs were on the table, ChromaDB was off it.

The actual choice: Supabase with pgvector. [ADR-001]

Supabase gives you full Postgres with pgvector bolted on — vector search and relational queries in the same transaction. Row-Level Security already in the stack. REST API out of the box. Deployable from Vercel serverless without running your own database. One service instead of two.

The practical gotcha that hit immediately: the Supabase REST client is unreliable for high-frequency writes. Any operation that needs reliability — ingests, audit log writes — goes through psycopg (direct Postgres connection), not the REST client. That meant the connection string matters: `SUPABASE_DB_URL` has to be a `postgresql://` URI, not the `https://` REST URL. And on Vercel, which is IPv4-only, the direct DB connection string resolves to IPv6 and fails. The Transaction Pooler (port 6543) is the only path that works in production serverless.

```
# Works on Vercel:
postgresql://postgres:...@aws-0-us-east-1.pooler.supabase.com:6543/postgres

# Fails on Vercel (IPv6 only):
postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres
```

RLS is scaffolded but enforcement is Phase 2. Tenant isolation currently runs at the application layer via owner filtering — every query scopes to an owner. Good enough for a family system where the attacker model is "Annie reads Mike's engineering notes," not "external actor bypasses the API."

---

## Embeddings via OpenRouter (and the Model Name That Broke Ingest)

Embeddings route through OpenRouter, not directly to OpenAI. The reason is routing flexibility — OpenRouter keeps model selection decoupled from provider lock-in. Swapping models later means changing a config string, not rotating credentials.

The model string caused a real ingest failure. OpenRouter uses a `provider/model` format — the correct identifier is `openai/text-embedding-3-small`, not `text-embedding-3-small`. Passing the bare model name hit errors at the OpenRouter API boundary. The fix was adding `OPENBRAIN_EMBEDDING_MODEL` as an explicit env var rather than hardcoding the string, and settling on the fully-qualified `openai/text-embedding-3-small` as the canonical value across all ingest paths.

Consistent dimensions across every ingest path (Slack, Obsidian, direct API) is a hard constraint. Mixing embedding models — even different versions of the same model — produces junk retrieval because vectors from different models don't share the same semantic space. One model, one env var, enforced everywhere.

---

## Retrieval: Why Pure Vector Search Failed

The first retrieval eval ran at below the 90% pass rate threshold. Pure vector search had two problems: [ADR-002]

1. **Short-document bias.** Dense content in a small embedding space scores artificially high on vector similarity. A 3-line chunk with relevant keywords beats a detailed 50-line explanation of the same topic.

2. **Exact-match misses.** A query for `terraform modules` needs the keyword match, not just semantically similar content. `infrastructure automation patterns` is vector-close but not what you're looking for.

The fix: hybrid retrieval. Postgres full-text search (`tsvector`) fused with pgvector cosine similarity via Reciprocal Rank Fusion (RRF), with a length penalty on short documents. Keyword results are inserted first in the merged list — precision before recall. Vector results fill the gaps.

The length penalty threshold is tunable. The RRF k value is tunable. Both were set against the eval harness and haven't needed adjustment since.

After the fix: **96.9% pass rate on a 1,000-query harness**. Confidence distribution: 22% high, 70% medium, 8% low.

---

## Ingest Pipeline

`scripts/ingest.py` handles the standard path: read source, chunk by heading boundaries, embed each chunk, write to `public.thoughts`.

A few design decisions that made operations cleaner:

**Deterministic `ingest_id`.** MD5 hash of owner + content. Re-ingesting the same document is a no-op — no duplicate rows, no cleanup needed after failed runs.

**Pre-flight validation.** Before any write: owner presence check, schema column validation, source reachability, existing row count. The ingest endpoint returns a `preflight` object with `status`, `warnings`, `errors`, and `existing_rows`. Duplicate risk is surfaced explicitly before the write happens.

**Heading-based chunking.** Chunks split on heading boundaries, not sliding token windows. Sub-chunks inherit the parent heading for retrieval context. No overlap — overlap is a 20% token tax for zero retrieval benefit.

---

## Slack Capture

A Supabase Edge Function (`ingest-thought`) handles Slack messages. Verifies the request via Slack signing secret, filters to user-authored messages, enriches with user identity, embeds via OpenRouter, inserts to `public.thoughts`, posts a confirmation back in-thread. The confirmation matters — it makes the capture loop visible rather than invisible.

The identity side: every Slack capture upserts a row in `open_brain_users`, building a durable identity mapping across message sources. Slack user ID → owner string → tenancy boundary.

---

## Integration Surfaces

**Claude Code (MCP)** — a stdio MCP server registered in `.mcp.json` exposes four tools natively in Claude Code sessions: `openbrain_query`, `openbrain_ingest`, `openbrain_generate_quiz`, `openbrain_generate_flashcards`. The session start hook fires `openbrain_query` automatically. By the time the first prompt is typed, the model already has project state.

**Custom GPTs (ChatGPT)** — three family Custom GPTs, one per user, backed by an OpenAPI 3.1.0 spec. Each gets an isolated bearer token. `OPENBRAIN_TOKEN_OWNER_MAP` resolves token → owner at the API layer — adding a new user is an env var update, not a code change.

**Tenancy model.** Every document has an `owner` field. Every query scopes to an owner resolved from the bearer token. The token owner map is the single source of truth. Annie's tutoring notes stay in Annie's namespace. They're not queryable by Beth's token or Mike's token.

---

## What It Unlocked

The practical test: start a session after a week away from a project. Query for "recent architectural decisions" and "what's in flight." Get back specific notes, specific decisions, specific reasoning — not a generic summary, but the actual content ingested in previous sessions.

That's the system working. The cold-start problem isn't a context window size problem. It's a persistence problem. OpenBrain solves it by making context a queryable artifact rather than a thing you re-explain.

Project overview: [OpenBrain](/blog/project-openbrain)
