---
title: "Project: OpenBrain 2.0 — Temporal Knowledge Architecture"
description: "A home network hardware migration exposed the fundamental flaw in my RAG system. Here's the architecture Claude and I designed to fix it: temporal state, write safety, and a compounding wiki layer."
pubDate: 2026-05-14
category: projects
draft: false
---

I recently completed a hardware refresh on my home network — 10G switches, a new WiFi 7 router, a more robust VLAN architecture. As Claude and I worked through the project, I kept running into the same problem: AI absentmindedness. Stale context pulling in old IP assignments. Wrong VLAN IDs. Device configs that had been superseded two iterations ago but were still in the knowledge base with full retrieval weight, indistinguishable from current state.

I'd already found Andrej Karpathy's write-up on using Markdown files as persistent model references, but it didn't feel like the right fit — too static, too manual. Then I watched Nate Jones' video on the same problem and something clicked. The issue wasn't just that context was missing; it was that the existing context was actively wrong, and the system had no way to know the difference.

Now — after getting over my frustration with AI's reliable insistence on bypassing guardrails in the name of "efficiency" — Claude Chat, Claude Code, and I sat down and designed something better. Here's what we built.

## The Problem: Temporal Blindness

OpenBrain 1.0 treated all knowledge as equally present-tense. Every record in the vector store competed for retrieval on equal terms, regardless of when it was written or whether it was still true. A VLAN configuration from before the migration and the updated one after it had identical semantic weight. A query returned both, indistinguishably. The old record wasn't just useless — it was actively misleading.

This is the problem vector stores don't solve by default. They're retrieval engines, not state machines. They have no concept of "this was true then, this is true now."

The specific failure modes the migration made impossible to ignore:

**No supersession.** When a device moved to a new VLAN segment, both the old and new records existed with equal retrieval weight. There was no mechanism to mark the old one as replaced. The system couldn't distinguish "current config" from "config that was true six weeks ago."

**No domain separation.** Study notes (NV exam prep, Terraform reference material) competed equally with operational state queries. A question about current network topology pulled in certification study cards alongside live device configs.

**No lifecycle.** Every record was equally present tense. There was no `current`, `superseded`, or `historical`. A record from before the hardware refresh and a record from after it had identical standing in retrieval.

**No compounding synthesis.** Every session re-derived understanding from raw chunks. Nothing accumulated. The same synthesis work happened on every query, from scratch, with no persistent artifact representing "the understood current state of this network."

## Design Influences

Two pieces of thinking shaped the architecture:

**[Karpathy's LLM Wiki](https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f)** — the argument that a wiki is not a static document but a compounding artifact. Write-time compilation produces persistent understanding that improves across sessions rather than re-deriving from scratch. The database is truth; the wiki is a derived artifact.

**Nate Jones' Hybrid Blueprint** — database as source of truth, wiki as generated output, strict source-of-truth rule. If the wiki is wrong, fix the source records and recompile. Never edit the wiki directly.

Both pointed to the same structure: a three-layer system where raw knowledge records, temporal lifecycle, and compiled synthesis are distinct concerns.

## Architecture: The Three Layers

### Layer 1: The `knowledge` Table

A single unified table with explicit taxonomy columns — `domain`, `environment`, `system`, `tags[]` — replacing the JSONB field-hunting that `public.thoughts` required.

The key addition is the temporal lifecycle:

```sql
status      TEXT CHECK (status IN ('current','superseded','historical','draft'))
valid_from  TIMESTAMPTZ DEFAULT now()
valid_until TIMESTAMPTZ  -- NULL means still current
supersedes_id UUID REFERENCES public.knowledge(id)
```

Status semantics are strict:
- `current` — the authoritative present-tense record for this component
- `superseded` — replaced; `valid_until` is set to the moment of replacement
- `historical` — migrated from the old `thoughts` table; treat as reference, not current state
- `draft` — staged, pending human approval before becoming current

Retrieval defaults to `status = 'current'`. Stale state is excluded without callers needing to know it exists. A device that moved subnets during a network refresh has one current record and a chain of superseded ones — the old configs are preserved for audit but don't pollute queries about present state.

### Layer 2: Write Safety

Agents get INSERT-only permissions via Supabase Row Level Security. No UPDATE, no DELETE. The reasoning: agents should not be able to silently rewrite history.

To supersede a record, a two-step process is required:

1. **Agent:** `POST /api/propose_supersession` — creates a `draft` record pointing at the record being replaced. Returns a `proposal_id`. No commit yet.
2. **Human:** `POST /api/confirm_supersession` — atomically sets the old record to `superseded` (with `valid_until`) and the draft to `current` (with `valid_from`). Both updates happen in a single transaction or neither does.

No AFTER INSERT trigger for the commit step — that would let an agent self-approve a supersession by inserting directly with `status='current'`. The two-step design keeps human sign-off in the loop for operational state changes.

A PostgreSQL trigger blocks duplicate `current` records for the same `system` and `component:*` canonical tag. Study content (`system IS NULL`) has no deduplication constraint — unlimited current records are valid for reference material.

### Layer 3: The `wiki_pages` Table

Compiled synthesis pages. Each row is a markdown document generated from a set of `knowledge` records. The table stores `compiled_from` (UUID array) — the exact knowledge rows that contributed — and `is_stale` (boolean).

**Explicit compilation only.** Ingest never triggers wiki compilation automatically.

The case for auto-compile on ingest seems intuitive — new knowledge arrives, update the wiki. The case against it is stronger:

- Every ingest becomes slow: DB write + LLM call in the request path
- N ingests in a burst = N LLM compilation calls, most immediately superseded
- A wiki compiled after ingest #3 in a burst of 10 is stale by ingest #4
- A compilation failure (rate limit, timeout) would block ingest

Instead: ingest marks affected wiki pages `is_stale = true`. A separate call to `POST /api/compile_wiki` triggers synthesis when a coherent snapshot is desired. The compilation cost is paid once, on demand, not once per ingest.

`GET /api/wiki/{page_name}` returns the compiled page with an `is_stale` flag. Callers can decide whether a stale page is good enough or whether to trigger a recompile first.

## Migration

699 rows from `public.thoughts` were classified and migrated to `public.knowledge` with `status='historical'`. Domain classification required path-based rules for the largest bucket (`engineering/notes` — 391 rows) because subject alone was insufficient to distinguish IaC study notes from homelab operational notes.

The `thoughts` table is untouched and remains available. New writes target `knowledge`. Legacy endpoints continue reading `thoughts` during the validation window. After human sign-off on migration quality, legacy endpoints will be updated and `thoughts` renamed to `thoughts_archive`.

## API Surface

Six new endpoints added in Stage 3:

| Endpoint | Purpose |
|---|---|
| `POST /api/ingest_state` | Insert a knowledge record with temporal fields |
| `POST /api/propose_supersession` | Stage a draft supersession for human review |
| `POST /api/confirm_supersession` | Atomically commit — old → superseded, draft → current |
| `GET /api/query_state` | Filter knowledge by domain, environment, system, status |
| `POST /api/compile_wiki` | LLM-synthesize a wiki page from current knowledge records |
| `GET /api/wiki/{page_name}` | Return a compiled wiki page |

All existing `/openbrain_*`, `/claude_*`, and `/query` endpoints continue working against `thoughts` unchanged.

## What's Next

The immediate next step is state promotion: reviewing the 699 migrated `historical` records, identifying the operational ones that deserve `current` status, and using `propose_supersession` + `confirm_supersession` to establish the initial authoritative state. Then the session startup protocol becomes real: Claude queries the wiki at the start of each session and gets compiled current state rather than raw chunk retrieval.

After that: updating the legacy query endpoints to target `knowledge`, and eventually renaming `thoughts` to `thoughts_archive`.

The interesting horizon is behavioral. Once the wiki layer is populated and compounding, the question changes from "what do I know?" to "what has changed since I last looked?" That's a different retrieval problem, and a better one.

---

Architecture Decision Records: [ADR-007](https://github.com/MikeMcMahon-dev/openbrain/blob/main/docs/decisions/ADR-007-knowledge-table.md) · [ADR-008](https://github.com/MikeMcMahon-dev/openbrain/blob/main/docs/decisions/ADR-008-temporal-lifecycle.md) · [ADR-009](https://github.com/MikeMcMahon-dev/openbrain/blob/main/docs/decisions/ADR-009-wiki-layer.md) · [ADR-010](https://github.com/MikeMcMahon-dev/openbrain/blob/main/docs/decisions/ADR-010-write-safety.md)
