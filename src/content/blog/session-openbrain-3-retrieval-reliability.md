---
title: "Session: OpenBrain 3.0 — Retrieval Reliability"
description: "Two AI agents disagreed about whether OpenBrain's retrieval was broken. Resolving it meant going to the raw table row by row. Notes from the session that closed out the retrieval-reliability release."
pubDate: 2026-07-30
category: sessions
draft: false
---

This session closed out the [OpenBrain 3.0 retrieval-reliability release](/blog/project-openbrain-3-retrieval-reliability). The interesting part wasn't the code — it was watching two AI agents disagree about whether a system was broken, and settling it by querying the database instead of letting either one win by sounding confident.

## Where it started

The retrieval-reliability work began the way the best debugging does: Claude Chat, mid-session, caught *itself* reasoning off a stale note. The authoritative current-state documents weren't surfacing; older dated event notes were winning. That flag turned into a multi-phase release — instrument the retrieval path, fix the recall bug, split the two-stage skim/fetch, and chunk long documents into sections. By the time this session started, all four phases had shipped and merged.

Then Chat filed a follow-up: four remaining gaps in the chunking work.

## The disagreement

I had Claude Code re-examine Chat's four points against the store. Two of them looked wrong on a quick check — a single count query said there was no coverage gap, so Code flagged them as refuted and drafted a tidy reply saying so.

Chat pushed back. Not with an opinion — with row IDs. Three specific chunks, their word counts, their document IDs, and a sharper claim: *you're measuring the wrong thing.*

It was right, and the correction is worth writing down. Code's check asked "how many long documents are missing from the chunk table?" — zero, because every long doc *was* in the table. But being in the chunk table isn't the same as being split into sections. Chat's question was the real one: "did they actually get divided?" For twenty documents the answer was no. Headingless notes — numbered prose with no `#` markers — had collapsed into a single undivided chunk. One of them was 1009 words: a multi-topic wall carrying exactly the diluted embedding that chunking existed to eliminate.

Same table. Two different definitions of "chunked." The only way to tell who was right was to stop arguing and query the raw rows.

## The method that came out of it

So that's what we did — and it became the rule for the rest of the session. When the two agents disagreed, neither got to win by assertion. I dropped to a psycopg script against the store and asked the measurable question directly: not "how many docs are unchunked" but "how many single chunk rows are large enough to dilute their own embedding." The answer settled it every time, usually against whichever agent had been more confident.

The final tally on Chat's four points: two were real and worth fixing, one was already built (I'd forgotten the collapse step already attached sibling pointers), and the one everybody had initially "refuted" was the most important of the lot.

## What actually got fixed

Three code changes, all small, all verified against the live store before I believed them:

1. **The chunker learned to split headingless walls.** A section with no headings windows by paragraph; a single paragraph with no line breaks windows by sentence. Nothing survives as one blob anymore.
2. **Confidence stopped lying.** The current-state boost from the prior phase was quietly compressing the score gap that labels a result "high confidence," so a genuinely strong top hit read "medium." Confidence now keys off raw cosine similarity, which the boost doesn't touch.
3. **Headings stopped faking it.** A headingless chunk was borrowing its provenance string ("Personal") as a section title. Now the heading is real or null, with an explicit `chunked` flag so the caller knows what it's holding.

Then a re-chunk backfill against the store to make it real: 800 documents, 1266 chunks re-embedded. I had to add a `--rechunk` mode first — the existing backfill used `ON CONFLICT DO NOTHING`, which on a re-run would have left the old fat chunk in place and only appended the new tail. Delete-then-insert, per document, committed one at a time so an interrupted run is never a hybrid.

## The numbers

Before and after, straight from the audit query:

| metric | before | after |
|---|---|---|
| chunks over 400 words | 25 | 5 |
| chunks over 600 words | 9 | 1 |
| largest single chunk | 1009 words | 738 words |
| fat *headingless* chunks | 20 | 0 |

The five chunks still over 400 words are all real titled sections sitting under the ceiling — structure, not walls. And the confidence fix checked out live: the sample query that used to read "medium" now reads "high."

## The takeaway

I've had two AI models pair with me before, but this was the first time I watched them genuinely adjudicate a technical disagreement — one asserting, the other refuting, then converging on ground truth because I made both of them show their work against the table. Neither was reliably right. The row data was. My job was mostly to refuse to accept a confident answer without a query behind it, which turns out to be the same job it's always been.

Project overview: [OpenBrain 3.0 — Retrieval Reliability](/blog/project-openbrain-3-retrieval-reliability)
