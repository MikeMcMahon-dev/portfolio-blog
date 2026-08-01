---
title: "Project: OpenBrain 3.1 — Retirement, Done as Records"
description: "3.0 made retrieval reliable — the right record comes back. 3.1 makes retirement reliable — the wrong one gets retired as a first-class, immutable event instead of an in-place UPDATE that erased its own history. A service pack, built by two agents who couldn't agree, then shipped past a gate that caught them not agreeing."
pubDate: 2026-08-01
category: projects
draft: false
---

[OpenBrain 3.0](/blog/project-openbrain-3-retrieval-reliability) fixed retrieval: the right record reliably comes back out of the brain. 3.1 is the other half of the same coin — making *retirement* reliable. It's a service pack, not a new version, because it doesn't add a capability; it fixes how an existing one behaves.

Here's the problem it closes. When a fact changes — a DNS server gets decommissioned, a VLAN gets renumbered — the old note has to stop being "current." In 2.0 that was an in-place `UPDATE knowledge SET status = 'superseded'`. It worked, and it destroyed evidence: *what* retired the row, *when* it actually stopped being true, and *why*, all overwritten in place. Worse, nothing in the system ever noticed that a new note *contradicted* a current one. A human had to catch it — which is exactly the thing a solo operator fails to do at 11pm.

3.1 turns retirement into an append-only record.

## The decisions I made

**Supersession is an event, not an edit.** Every retirement is now an immutable row in a `supersession_events` log — superseded record, successor (nullable, for a plain expiry), when, why (a reason code), and who. `knowledge.status` stops being something a dozen code paths UPDATE and becomes a *projection*: a single database trigger reading the event log is the only writer of "superseded." The log is the truth; the status column is rebuildable from it. Recovery from a bad projection is **replay, not restore** — which is a very different, much calmer sentence to read during an incident.

**Contradiction detection surfaces candidates, not verdicts.** Same-system, high-similarity `current` pairs get queued for a human to look at. It does *not* decide they contradict — because two similar records often both true. When I measured it, the top "contradictions" in my own vault were an ADR and its execution log, or four stages of the same crash investigation. All legitimately current. The machine's job is to raise its hand; mine is to judge.

**Bitemporality: two clocks, kept apart.** *System time* (when we recorded it) and *valid time* (when the fact was actually true) are different, and 2.0 conflated them — a change you document a week late got stamped with today's date. 3.1 separates them, so retiring a "pre-CA" note can carry the *actual* deploy date as its end, and the history stays queryable as-of any point.

## The decisions I bypassed, and why

**Cryptographic signing of transitions — rejected.** The pattern underneath (transitions as first-class records) I adopted in full; the crypto I didn't. Signing proves *who wrote this and that it wasn't altered*. The threat model here is single-tenant, single-writer, human-gated, no untrusted party. A valid signature on the June "it's healthy" note would not have made it any less wrong. Revisit if the vault ever goes multi-writer.

**Automated contradiction judgment — rejected.** Deciding whether two records semantically contradict is a research problem. At this corpus size, a short human review queue is the entire win; a fancy judge is a way to be confidently wrong at scale.

**Bitemporality was deferred — then I un-deferred it.** The original plan parked it: the fact/ingest-time distinction had never once shown up organically in the data, so building for it looked like speculation. I pulled it forward anyway. It's a lab; state churns; "a change is coming" is a permanent condition, not a maybe — and the column was *already there*, silently claiming to mean fact-time while delivering ingest-time. A populated column that lies is worse than an empty one.

**A compiled-wiki feature — left dormant.** I found a whole materialized-wiki surface that shipped in an earlier cutover with zero rows and zero callers. Rather than polish it (the plan had a phase for that), I parked it with a decommission date. Building on top of a thing nobody uses is how you get five more things nobody uses.

## What actually shipped

Five phases, all applied to production and verified end to end: the recency net (3.0's tail), metadata single-sourcing, the transition-record log with its projection trigger, the contradiction review queue, and bitemporality. Behind all of it is one new rule with teeth: **every capability must have a caller.** A column, a parameter, a flag that lands in the schema but that nothing can actually *set* is now a build failure, not a TODO — because I shipped exactly that mistake more than once and this release is largely the story of finding them.

That story — two AI agents writing the design, and what happened when I built it — is in the [session log](/blog/session-openbrain-3-1-two-agents-wrote-an-adr).

## References

- The temporal-invalidation question that kicked this off was put to the community around [Nate B. Jones](https://www.youtube.com/@NateBJones)' Substack; three substantive replies shaped the append-only-events direction.
- Prior OpenBrain posts: [2.0 architecture](/blog/project-openbrain-2-architecture) · [3.0 retrieval reliability](/blog/project-openbrain-3-retrieval-reliability)
