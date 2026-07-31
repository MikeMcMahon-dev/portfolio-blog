---
title: "Session: OpenBrain 3.0 — Retrieval Reliability"
description: "Two sessions to make the brain reliably return the right thing: one to build the retrieval pipeline, one where two AI agents argued about whether it worked and settled it by querying the raw table."
pubDate: 2026-07-30
category: sessions
draft: false
---

This is the working log behind the [OpenBrain 3.0 retrieval-reliability release](/blog/project-openbrain-3-retrieval-reliability). It took two sessions: the first built the retrieval pipeline end to end, and the second is where it got interesting — two AI agents disagreed about whether that pipeline actually worked, and the only way to settle it was to stop arguing and query the database.

## Session 1 — Building the retrieval pipeline

The whole thing started the way the best debugging does: Claude Chat, mid-session, caught *itself* reasoning off a stale note. The authoritative current-state documents weren't surfacing; older dated event notes were winning retrieval. [OpenBrain 2.0](/blog/project-openbrain-2-architecture) had already fixed *which* record was true — temporal state, `current` vs `superseded`. But the right record still wasn't reliably coming back. That flag became the release thesis: retrieval was unreliable in a specific, diagnosable way, and I was done guessing at it.

I built the fix in four phases, deliberately ordered, because the first one changes how you see the rest.

**Instrument before touching anything (ADR-014).** The ranking method (Reciprocal Rank Fusion) fuses on *rank* and throws away magnitude, so the fused score is a fixed reciprocal per position — it tells you nothing about *why* a result ranked where it did. So before changing behavior, I exposed the raw signals underneath: vector cosine distance, lexical rank, how many retrievers hit. You can't fix retrieval you can't measure.

**Fix recall, not "dilution" (ADR-015).** With the instrument in place, the missing-long-docs problem resolved to something boring and correct: the vector index is IVFFlat, and the default `probes=1` scans a single list — a handful of rows. A genuinely top-similarity doc in another list was simply never considered. For weeks I'd assumed this was embedding dilution. It wasn't; it was probe count. Raising it restored near-exact recall. This is the phase I'm proudest of, because the instrument turned a plausible-but-wrong theory into a provably right one.

**Two-stage skim then fetch (ADR-016).** Retrieval was returning full document text inline, duplicated across two blocks of the payload. I split it: a cheap skim returns metadata + snippet + signals, the agent picks what it wants, and a fetch-by-id pulls full text only for those. Removed about half the payload.

**Heading-based chunking (ADR-017).** The direct fix for dilution. Documents split into per-section chunks on their headings; each section embeds with its parent title prefixed so it still carries the entity, and retrieval collapses the chunks back to one row per document. A narrow query now matches a tight section instead of a blurry whole-doc average. Alongside it, a boost for current-state living docs so stale event notes stop out-ranking them — gated to `current` status only, so a superseded row with the same tag never gets lifted above the live one.

That was session one: instrument, recall, skim/fetch, chunking. Shipped across a run of PRs and merged. I thought the release was basically done.

## Session 2 — The reconciliation, and the backfill

Then Chat filed a follow-up: four remaining gaps in the chunking work.

I had Claude Code re-examine them. Two looked wrong on a quick check — a single count query said there was no coverage gap, so Code flagged them refuted and drafted a tidy reply saying so.

Chat pushed back. Not with an opinion — with row IDs. Three specific chunks, their word counts, their document IDs, and a sharper claim: *you're measuring the wrong thing.*

It was right, and the correction is the whole point of the session. Code's check asked "how many long documents are missing from the chunk table?" — zero, because every long doc *was* in the table. But being in the chunk table isn't the same as being split into sections. Chat's question was the real one: "did they actually get divided?" For twenty documents the answer was no. Headingless notes — numbered prose with no markdown headings — had collapsed into a single undivided chunk. One was 1009 words: a multi-topic wall carrying exactly the diluted embedding chunking existed to eliminate.

Same table. Two definitions of "chunked." The only way to tell who was right was to drop to a script against the store and ask the measurable question directly — not "how many docs are unchunked" but "how many single chunks are large enough to dilute their own embedding." That became the rule for the rest of the session: when the two agents disagreed, neither won by assertion. Go to the table. The answer settled it every time, usually against whichever agent had been more confident.

The final tally on Chat's four points: two real and worth fixing, one already built (the collapse step already attached sibling pointers — Code had forgotten), and the one everybody initially "refuted" was the most important of the lot.

Three code fixes came out of it, each verified against the live store before I believed it:

1. **The chunker learned to split headingless walls.** No-heading sections window by paragraph; a single paragraph with no line breaks windows by sentence. Nothing survives as one blob.
2. **Confidence stopped lying.** The current-state boost was quietly compressing the score gap that labels a result "high confidence," so a strong top hit read "medium." Confidence now keys off raw cosine similarity, which the boost doesn't touch.
3. **Headings stopped faking it.** A headingless chunk was borrowing its provenance string ("Personal") as a section title. Now it's real or null, with an explicit `chunked` flag.

Then a re-chunk backfill to make it real: 800 documents, 1266 chunks re-embedded. I had to add a `--rechunk` mode first — the existing backfill used `ON CONFLICT DO NOTHING`, which on a re-run would have left the old fat chunk in place and only appended the new tail. Delete-then-insert, per document, committed one at a time so an interrupted run is never a hybrid.

The numbers, straight from the audit query:

| metric | before | after |
|---|---|---|
| chunks over 400 words | 25 | 5 |
| chunks over 600 words | 9 | 1 |
| largest single chunk | 1009 words | 738 words |
| fat *headingless* chunks | 20 | 0 |

The five chunks still over 400 words are all real titled sections under the ceiling — structure, not walls. And the confidence fix checked out live: the sample query that used to read "medium" now reads "high."

## The takeaway

I've had two AI models pair with me before, but this was the first time I watched them genuinely adjudicate a technical disagreement — one asserting, the other refuting, then converging on ground truth because I made both of them show their work against the table. Neither was reliably right. The row data was. My job was mostly to refuse to accept a confident answer without a query behind it, which turns out to be the same job it's always been.

Project overview: [OpenBrain 3.0 — Retrieval Reliability](/blog/project-openbrain-3-retrieval-reliability)
