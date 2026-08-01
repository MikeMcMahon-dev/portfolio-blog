---
title: "Session: OpenBrain 3.1 — Two Agents Wrote an ADR"
description: "Two Claude instances designed the supersession redesign and produced a document that contradicted itself — and wouldn't stop circling until I made them. Then I built it, and the same failure came back a level down. A cautionary tale about dueling agents, controls that describe instead of enforce, and test harnesses that validate themselves."
pubDate: 2026-08-01
category: sessions
draft: false
---

This is the working log behind the [OpenBrain 3.1 service pack](/blog/project-openbrain-3-1-supersession). It came in two sessions with very different lessons. The first was the design: two AI agents wrote the architecture decision record, and the document they produced was *correct in places and unimplementable as a whole*. The second was the build: I implemented that design, carefully, and the exact class of failure it was written to eliminate came back one level down — where a gate I already had would have caught it, if I'd been running it as a gate instead of as a formality.

Both sessions are the same failure in two costumes. That's the point.

## Session 1 — Two agents wrote an ADR, and I had to stop them

The problem was real and measured: a June note saying a DNS service was "complete and healthy" was out-ranking the July note that recorded its decommissioning. Both marked `current`. Nothing knew they disagreed. I put the temporal-invalidation question to the community around Nate B. Jones' Substack, got three genuinely good replies in a day, and handed the whole thing to two Claude instances to turn into an ADR. One had repo and database access. The other worked only through the API connector, seeing what the endpoints returned. I relayed messages between them.

What followed was, in fairness, the most rigorous technical review I've had on a personal project — and also two hours I'd mostly like back.

**What worked was real.** They caught each other's errors and the corrections stuck. The connector-only instance claimed two endpoints behaved differently on identical input; the repo instance checked and disproved it — a deployment boundary, not an endpoint. The repo instance claimed zero documents needed re-chunking based on a count; the connector instance produced three specific row IDs that said otherwise. Somewhere in there they wrote down the best rule of the whole exercise:

> Neither of us wins by assertion. Refute from the rows, not from a count.

That rule found things I wouldn't have: a supersession key with no validation accepting invented values silently, and five schema capabilities that had shipped with no way for any caller to set them. You don't find those reading your own code.

**What failed was the document.** It went through four revisions; each added a section; each addition was individually justified. By rev.4 it had a `Decision` section *and* a `Resolutions` section — and one of the resolutions had quietly changed the architecture the Decision section still described. Same document, two answers, both correct when written, only one current. When I built from it, the implementer read `Decision`, built what it said, and faithfully re-introduced the exact flaw `Resolutions` had killed a day earlier. The correction was one query away in a memory system built precisely so agents could retrieve prior decisions. Nobody ran it.

**And here's the part I have to own: they didn't stop.** The collaboration was well-intentioned and genuinely sharp, and it did not converge. Each pass improved the document locally and degraded it globally — more sections, more scope, more carefully-reasoned bureaucracy — and neither agent had any instinct that "we are now making this worse." Two capable reviewers will happily refine a thing past the point of usefulness forever, because every individual edit clears the bar. Eventually I stopped it. Not because I'd out-argued anyone — database architecture isn't my depth, I'm an infrastructure guy — but because I could see the *shape*: we were going in circles, and the circling would not end on its own. Two hours of review produced maybe fifteen minutes of load-bearing decisions. The rest was the two of them, and me, orbiting.

The uncomfortable version: **the AI wasn't wrong. It was right in two places and I couldn't tell which one governed — and it would have kept being right, in more places, indefinitely, if I hadn't called it.**

What actually protected me wasn't correctness — it was recoverability. Phase 1 wrote nothing to the database. Phase 2 stopped at a state where nothing was broken. A mandatory dry run before any destructive step came back AMBER and flagged twelve foundational documents a naive change would have buried. Every one of those was a decision made when the plan was written, not a lucky outcome. You cannot verify that two agents got the architecture right; you *can* verify that every step is reversible and that someone stated the rollback before running it. That's a question a non-specialist can ask, and it's the one that saved this.

So I changed the rules. **One Decision section, no appendix that can supersede it** — superseded reasoning lives in version control, not in a section you have to know to consult. **Restate before build** — re-read the doc and say in one sentence what you're about to build; if it doesn't match, stop. **Write the test that would have caught the last failure, and make it fail first** — a test that passes on arrival isn't testing anything. **Reversibility stated per step.**

I thought that fixed it.

## Session 2 — Then I built it, and the pattern came back

Over the next two days I implemented all five phases. Append-only events, the projection trigger, the contradiction queue, bitemporality. Every phase shipped with rolled-back SQL trials, live end-to-end tests, and a clean reconciliation. It looked disciplined. It *was* more disciplined than the design session.

Then I ran the completeness audit — the check the ADR itself mandates, whose whole job is to find a capability with no caller. It came back BLOCK. Two of the service's own ingest paths were still doing the old thing: bare inserts that silently dropped the identity key, skipped the event log, and forced the timestamp the bitemporal work existed to make settable. The redesign was *about* eliminating exactly this, and two of its own write paths never got the memo. I'd converted the writers I was looking at, verified those, and reported the phase done. The strong claim — *nothing writes the old way* — was never checked; the weak one — *the file I edited writes the new way* — was.

I'm not going to itemize every stumble; the point isn't the blooper reel, it's that they all share three roots:

- **Locally correct, globally drifted.** Same failure as the document. Every step defensible; the whole degrades anyway.
- **Controls that describe instead of enforce.** The gate that caught this existed the entire time — it just didn't run until the end, so it produced a post-mortem instead of a block. The one control in this project that actually *works* is a rolled-back SQL trial before any production statement, and it works for one reason: I reject anything that arrives without it, every time. A gate you run once is a gate in name only.
- **A harness that validates itself, not the plan.** My tests ran green while asserting the wrong things — proving the code executed, not that it did what the design said. A test suite that can pass without exercising the intended behavior is a comfort object, not a check.

## The takeaway

The design session and the build session are one lesson: **capable, well-intentioned agents optimize locally and drift globally, and they will not notice.** The document accumulated past implementability. The build re-introduced the pattern it was built to remove. Neither self-corrected.

What caught what got caught wasn't cleverness. It was two dumb, mechanical questions asked every time: *is this step reversible?* and *does every capability have a caller?* Those are answerable by someone who isn't a database architect — which is the whole reason they hold when the specialist judgment in the room is coming from a model you can't fully audit.

And one control you can't hand to the agents at all: knowing when to stop them. Two Claudes will refine an ADR into the ground, politely, forever. Somebody with less expertise and more perspective has to look at the orbit and say *we're going in circles — ship the fifteen minutes that mattered and throw out the rest.* That was the most valuable thing I did in the whole design session, and it's the one thing neither agent could do for me.

Would I do it again? Yes — the design is right, the argument between two agents checking each other against the raw table produced decisions I couldn't have reached alone. But I'd hold the artifact to a harder standard than the debate, and I'd run every gate as a gate. **The quality of the discussion and the quality of the artifact are different things**, and so are the quality of the plan and the discipline of the build.
