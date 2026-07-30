---
title: "Project: OpenBrain 3.0 — Retrieval Reliability"
description: "OpenBrain 2.0 fixed which record was true. 3.0 fixed whether the right one actually comes back. A retrieval-reliability release built by instrumenting first, then fixing recall, dilution, and confidence — adjudicated by two AI agents arguing against the raw table."
pubDate: 2026-07-30
category: projects
draft: false
---

[OpenBrain 2.0](/blog/project-openbrain-2-architecture) solved a correctness problem: a vector store has no concept of "true then, true now," so a superseded VLAN config retrieved with the same weight as the live one. 2.0 added temporal state — `current`, `superseded`, `historical` — so the system could tell them apart.

Then I kept missing anyway. Not because the wrong record was marked current — 2.0 fixed that — but because the *right* record didn't reliably come back at all. I'd query for the current DNS architecture and get a six-week-old evening-update note instead of the authoritative current-state doc that was sitting right there in the store, correctly tagged `current`. Temporal correctness is necessary but not sufficient. If retrieval never surfaces the current record, it doesn't matter that you labeled it correctly.

OpenBrain 3.0 is the retrieval-reliability release. No new features — the whole release is about making "pull the right thing out of the brain" actually work.

## How it started: Chat filed the bug

The first flag didn't come from me. Claude Chat, mid-session, noticed it was reasoning off a stale note and said so — the long authoritative current-state documents weren't surfacing, and shorter event notes were winning retrieval. That became the release thesis: retrieval was unreliable in a specific, diagnosable way, and I was going to stop guessing at it.

## The problem, precisely

Three distinct failure modes, none of which 2.0 addressed:

**Long living-docs never surfaced.** The `knowledge.embedding` index is IVFFlat with 100 lists. pgvector's default `ivfflat.probes=1` scans a *single* list — roughly 8 of 800 rows. A genuinely top-similarity document sitting in another list is simply never considered. For weeks I assumed this was embedding dilution (long docs having "blurry" embeddings). It wasn't. It was an approximate-index recall miss, and the distinction mattered enormously for the fix.

**Whole-doc embeddings diluted narrow queries.** A 900-word current-state document embeds as one vector covering DNS, keepalived, failure domains, and cutover history all at once. A tight query for just "keepalived VIP failover" matches that blurry average weakly. Measured directly, a per-section embedding beat the whole-doc embedding by a mean **+0.217 cosine** on the sub-topic it covers.

**Stale event notes out-ranked current-state.** Even when the current-state doc surfaced, a flurry of dated "evening update" notes on the same topic could collectively out-rank it. The system had no notion that a `component:*`-tagged living doc is the authoritative one.

## The phases

I built this in deliberate order, each phase a separate ADR, because the first one changes how you see all the others.

### Phase 1 — Instrument before touching anything (ADR-014)

Reciprocal Rank Fusion, the ranking method, fuses on *rank* and discards magnitude — so the fused score is a fixed reciprocal per position and carries no relevance information. Reading it tells you nothing about *why* a result ranked where it did. So before changing any behavior, I exposed the raw per-retriever signals behind the fused ordinal: vector cosine distance, lexical `ts_rank`, each retriever's rank, and how many retrievers hit. You cannot fix retrieval you cannot measure, and until this phase every diagnosis was a guess.

### Phase 2 — Fix recall, not "dilution" (ADR-015)

With the instrument in place, the missing-long-docs problem resolved to the IVFFlat probe count, not embedding quality. Raising `ivfflat.probes` to 10 (≈√lists) restored near-exact recall at negligible cost on a table this size, plus a candidate-pool floor so a borderline high-similarity doc isn't dropped before fusion even sees it. This is the phase I'm proudest of, because the instrument turned a plausible-but-wrong theory (dilution) into a boring correct one (probe count).

### Phase 3 — Two-stage skim then fetch (ADR-016)

Retrieval returned full document text inline, duplicated across the grounding block and the results sidecar. I split it: a cheap **skim** returns metadata plus a snippet and the signals, the agent picks what it wants, and a **fetch-by-id** pulls the full text only for those. Response de-duplication removed the ~50% text duplication in the payload.

### Phase 4 — Heading-based chunking (ADR-017)

This is the direct fix for dilution. Documents split into per-section chunks on markdown headings; each section embeds with its parent title prefixed so it still carries the entity, and retrieval collapses chunks back to one row per parent document so a multi-section doc presents once, not N times. A narrow query now matches a tight section instead of a blurry whole-doc average. Alongside it, a **component boost** lifts `current`-tagged `component:*` living docs so stale event notes stop out-ranking them — carefully gated to `current` status only, so a superseded row carrying the same tag never gets boosted above the live one.

## The interesting part: two AIs arguing against the table

After the chunking pipeline shipped, Chat filed a follow-up report with four proposed gaps. Claude Code re-examined them and pushed back — two looked refuted by a quick count. Chat came back with specific row IDs and a sharper claim: I was measuring the wrong thing.

It was right. My check asked "how many documents are missing from the chunk table" — zero, because every long doc *was* in the table. Chat's question was "were they actually split into sections," and for twenty of them the answer was no: headingless documents (numbered prose, `1) 2) 3)`, with no `#` markers) collapsed into a single undivided chunk — a 400-to-1009-word multi-topic blob carrying exactly the diluted embedding chunking was supposed to eliminate. Same table, two definitions of "chunked," and the disagreement only resolved by querying the store row by row.

That became the working method for the release: when two agents disagree, neither wins by assertion — you go to the raw data. The fixes that came out of it:

- **Headingless windowing.** A section with no headings to split on now windows by paragraph, and a single wall-of-text paragraph with no line breaks windows by sentence, so nothing survives as one diluted blob. After a re-chunk backfill: fat headingless chunks went from **20 to 0**, max chunk size 1009 → 738 words (and that 738 is a real titled section, not a wall).
- **Confidence off similarity, not the fused score.** The `current`-state boost worked, but it compressed the gap between adjacent fused scores below the threshold that labels a result "high confidence" — so a genuinely strong top hit read "medium." Confidence now keys off boost-independent cosine similarity. A strong match reads "high" on its own merit; the sample query that read "medium" now reads "high."
- **A `chunked` flag and honest headings.** A headingless chunk no longer borrows its provenance string ("Personal") as a fake section title — the heading is real or null, and a `chunked` flag tells the caller what it's holding.

## Status

Production. Chunked reads serve live; the store is re-chunked and self-freshening on new ingests. The retrieval knobs — probe count, boost weight, confidence thresholds — are tunable against a signal harness rather than hardcoded guesses, which is the whole point of having built the instrument first.

Session notes: [OpenBrain 3.0 — Retrieval Reliability](/blog/session-openbrain-3-retrieval-reliability)
Prior architecture: [OpenBrain 2.0 — Temporal Knowledge Architecture](/blog/project-openbrain-2-architecture) · [OpenBrain (original)](/blog/project-openbrain)
