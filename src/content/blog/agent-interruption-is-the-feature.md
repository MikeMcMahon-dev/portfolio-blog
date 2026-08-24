---
title: "The Interruption Is the Feature"
description: "Mid-task messages now reach the agent while it is still working, and it changes the shape of the session more than any capability upgrade has. Notes from a day where three wrong turns each cost one sentence to correct instead of a full re-brief, plus the honest limit: steering got better, correctness did not."
pubDate: 2026-08-24
category: about
draft: false
---

I spent a day with Claude Code putting name constraints on an internal CA, and the technical write-up of that is [its own post](/blog/session-reported-success). This is about something else I noticed while doing it, which I think matters more to anyone deciding how to work with these tools.

Messages I type while the agent is mid-task now reach it during that task, rather than queueing behind it. That sounds like a scheduling detail. In practice it changed the session from a series of batch submissions into something that behaves like working alongside someone.

## Three wrong turns, one sentence each

The clearest example was a dashboard panel. I asked for certificate expiry and drift status to go onto the network overview I actually look at. What came back was a brand new dedicated dashboard - good work, wrong place, because a dashboard nobody opens is a check nobody runs.

Old shape: that costs a full round trip. Read the result, write a correction, wait for the rebuild, discover the new placement is also wrong.

What happened instead was that I typed "not top row - put it beside the thermal monitors" while it was still writing, and the correction landed inside the same working turn. Then it turned out the thermal row already had eight free columns sitting empty, so the fix required moving nothing at all.

Same thing happened when I noticed the installer script's output was ambiguous on a second run. I said so mid-task; three scripts got an idempotent validation path before the turn ended, rather than in a follow-up session where I would have had to re-establish what I meant.

The economics are what changed. When correcting a trajectory costs one sentence, you correct early and often. When it costs a round trip, you let small wrongness ride and fix it in a batch at the end, which is how you end up reviewing a finished thing you did not want.

## Background work that does not block the conversation

Two other things were running while that went on. A planning agent audited the whole effort for completeness in the background and came back with a list, one item of which was genuinely sharp: the expiry panels only turn orange 45 days out, so a renewer that starts failing tonight would stay invisible for weeks. That got fixed the same afternoon. Another item on its list was wrong, because it had read a stale local checkout rather than the merged state - which is its own lesson about taking agent output at face value.

The other was a permission layer that blocked the agent from writing to production ConfigMaps and executing into pods. That is friction, and it cost several minutes across the day. It also forced a shape I have come to like: the agent prepares the exact command, hands it over, I run it, and it verifies the result against the cluster afterwards. For production writes that is not a bad division of labour. I would not turn it off.

## What did not improve

Interactivity fixed steering. It did not fix correctness, and I want to be precise about that, because the two get conflated in every discussion of these tools.

In the morning we fixed a bug where `curl -sS` exits 0 on an HTTP error, so a failed write reported success. That afternoon, the monitoring job written to catch exactly that class of problem shipped its first draft with the same bug. Four hours apart. It was caught by pointing the push at a URL that returns 404, not by anyone reading the code, and the same thing happened twice more in the script that places the dashboard panel.

The explanation is not carelessness. Knowing something in context does not constrain what gets generated - the fix had been stored as an edit to one file, not as a rule about a class of mistake. And the defect is an absence, a check that is not there, which is nearly invisible while producing the shape of a working thing.

That limitation is not going anywhere soon, and no amount of conversational responsiveness touches it. What responsiveness buys you is the ability to say "run that twice and diff it" at the moment it matters, instead of finding out later.

## What I'd tell someone starting

Work with it, closely, and interrupt it. The failures are not where the marketing or the criticism says they are, and you only find your own list by running the thing against infrastructure you care about.

Then make it prove the work rather than describe it. Every real defect this session was caught by running a failure path - a deliberately wrong URL, a script run twice and diffed, a threshold set to zero to confirm the panel goes red. None were caught by reading, including by me.

Trust but verify still holds. The interruption just means the verifying can happen while there is still time for it to change something.
