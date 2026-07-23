---
title: "Session: The Generation Gap That Wasn't — When the Frontier Models Didn't Matter"
description: "Months after the first run, I re-ran the multi-agent eval across a fresh generation of models — Claude Fable 5, GPT-5.5, GPT-5.6 Sol. I expected the frontier tier to pull ahead. Instead the cheap model from a generation ago tied for first, one handwriting sample decided the entire ranking, paying 33× more bought nothing — and when I stress-tested that conclusion, half the quality signal turned out not to reproduce."
pubDate: 2026-07-22
category: sessions
draft: true
---

A few months back I built a dashboard to make my AI agent's eval costs visible, and
it immediately caught one OCR scenario eating two-thirds of the budget (that's the
[Failure Detection Dashboard](/blog/project-failure-detection-dashboard) story). This
session is the sequel, and it surprised me more than the original did. A new generation
of models had shipped — Claude Fable 5, GPT-5.5, GPT-5.6 Sol — so I re-ran the exact
same fixed suite across nine models, fully expecting the frontier tier to walk away
with it.

It didn't. The cheap model from the previous generation tied for first, and the most
expensive model on the board scored *worse* while costing 33× as much.

## First problem: the dashboard had gone dark

Before I could learn anything, I had to notice the dashboard was empty. The eval metrics
live in a Prometheus Pushgateway — the batch job pushes its numbers, the gateway holds
them, Prometheus scrapes the gateway. Elegant, except the gateway held everything **in
memory with no persistence**, and a node reboot weeks earlier had silently wiped every
number the last run pushed. Months of eval history: gone, and nothing told me.

So step zero was making the pipeline durable: a small PVC behind the Pushgateway's
`--persistence.file`, so a pod reschedule stops erasing the data. Unglamorous, but the
whole point of building a lens is that it's still there when you come back to look
through it.

## Getting a new model generation to even run

The harness was written for last generation's APIs, and the new models don't all speak
the same dialect:

- **OpenAI's GPT-5.x and o-series reject `max_tokens`.** They require
  `max_completion_tokens` — reasoning tokens are counted in the completion budget, so
  the parameter got renamed. The old call 400'd on every new OpenAI model until I
  switched it.
- **Claude Fable 5 has thinking *always on*.** My diagnosis parser grabbed
  `response.content[0]` and read its text — fine when the first block is the answer, a
  crash when the first block is a thinking block. Fable 5 always leads with one. The fix
  is to iterate the content blocks for the text, not assume its position.
- **GPT-5.5 Pro doesn't exist on the chat endpoint at all.** It's Responses-API only, so
  the chat-completions harness simply can't call it. I flagged it and left it out rather
  than fake a result.

Two lines of real change, one exclusion. A cheap smoke test on the new models caught all
of it before I spent real money. Then I ran the full sweep: nine models, ten scenarios,
$8.46, ninety scenario executions.

## The result: a flat line where I expected a slope

Here's the whole board, cheapest per-pass first:

```
gpt-4o-mini    4/10   $0.07    $0.018/pass
haiku-4-5      4/10   $0.14    $0.036/pass
gpt-4o         4/10   $0.37    $0.092/pass
sonnet-4-6     5/10   $0.46    $0.093/pass   ← top score, near-bottom cost
gpt-5.6-sol    5/10   $1.32    $0.264/pass
opus-4-8       4/10   $1.10    $0.275/pass
opus-4-7       4/10   $1.10    $0.276/pass
gpt-5.5        4/10   $1.44    $0.360/pass
fable-5        4/10   $2.45    $0.612/pass   ← priciest, and not even top score
```

Nearly everyone scored **4 out of 10**. The frontier models — Fable 5, GPT-5.5, both
Opus generations — did not beat Sonnet 4.6 or gpt-4o-mini. Fable 5 cost **33× more than
gpt-4o-mini for the identical score.** That's not the shape you expect when you line up
a capability ladder and press "go."

## One handwriting sample decides the entire ranking

The flatness isn't noise — it's structure. Broken down `by(scenario, status)`, the suite
is almost completely deterministic:

- **Four scenarios pass on all nine models** — the two happy-path infra deploys, plus
  two failure cases the diagnosis loop can actually recover.
- **Five scenarios fail on all nine models** — the failure-injection cases are
  unrecoverable by design, so every model runs the diagnosis loop to the same retry cap
  (14 attempts each) and none of them converts. More capability can't recover a failure
  that has no recovery.
- **Exactly one scenario discriminates the field:** OCR on a page of my daughter's
  handwritten biology notes. Only **Sonnet 4.6 and GPT-5.6 Sol** cleared the 0.80
  recovery threshold on it. Those are the only two models that scored 5/10.

So the entire "quality" spread across a 33× cost range comes down to a single question:
can the model read one page of a thirteen-year-old's handwriting? Everything else is
either a solved deploy or an unwinnable failure, and every model lands identically on
those.

## Two things the numbers say that benchmarks don't

**Token count is a terrible efficiency proxy.** gpt-4o-mini burned **476,000 tokens —
five times the entire rest of the field**, and ~99% of it was *input*. That's OpenAI's
vision-token accounting: mini bills image inputs at a steep multiplier, so the OCR pages
balloon its input count. And yet it was the **cheapest run on the board at $0.07.** The
token hog and the cost floor, simultaneously. If you rank models by tokens you get a
different — and wrong — answer than if you rank by dollars. Cost is the only axis that
matters, and it's the one raw benchmarks rarely report.

**Reasoning models deliberate more and resolve nothing more.** GPT-5.5, GPT-5.6, and
Fable 5 each emitted roughly **twice the output tokens** of Haiku and Sonnet on the same
diagnosis prompts (25–30K versus 12–14K). All that extra deliberation converted **zero
additional scenarios.** On a task with a deterministic ceiling, thinking harder just
costs more to arrive at the same place.

## Then I stopped trusting my own result

Here's the part I almost didn't write. A colleague poked at the story — *how much of that
handwriting score is the model, and how much is a crap input and a brittle rubric?* — and
the honest answer, once I chased it, was: **most of it wasn't measuring what I thought.**
The entire quality ranking rode on one scenario, so I put that one scenario under a
microscope. Three things fell out.

**Fable 5's zero was a refusal, not a failure.** The priciest model on the board scored
0.00 on the handwriting page, which I'd quietly filed under "expensive and bad." It isn't
bad — it *declined*. Fable 5 ships safety classifiers that target research biology, and
they false-positive on a thirteen-year-old's taxonomy homework: a clean HTTP 200 with
`stop_reason: "refusal"` and empty text. The tell is unambiguous — Fable 5 transcribes a
*geometry* worksheet just fine (0.89, rock-stable). So its "worst value on the board"
verdict was a policy decline misread as incapability, and my harness was scoring a
refusal as a capability failure. (It now records `REFUSED` as its own bucket.)

**A hint that should have helped, hurt.** The same colleague noted that telling a model
what it's looking at ("these are handwritten notes about X") usually improves OCR. So I
A/B'd it. It made scores slightly *worse* — and the reason is the rubric, not the model.
The ground truth scores against my daughter's *verbatim misspellings* ("Carl Lyn," not
"Linnaeus"; "orthopods," not "arthropods"). Priming the domain nudges the model to
*correct* the biology, which loses the verbatim match. Sonnet only wins because its
transcription convention hedges — it writes the misspelling **and** a bracketed
correction, `Carl Lyneus [Linnaeus]`, satisfying both. That scenario was measuring
error-preserving transcription convention, not OCR skill.

**And the metric doesn't survive a second run.** I ran it twice, back to back. Biology
scores swung up to 0.23 and flipped two models across the pass line *within a single
session*. One of my two "winners," GPT-5.6 Sol, passed at 0.92 in one run and failed at
0.62 in another. The whole quality ranking hinged on a scenario that won't reproduce.

The fix wasn't more runs — the noise is structural, not sample-size. It was a better
target. I re-scored the geometry worksheet on its **printed** content (the typed question
stems and multiple-choice options, not the handwriting) — clean text, no misspelling
lottery, and math, so Fable 5 doesn't refuse it. Same nine models, same two runs:
**seven of nine landed identical scores both times (0.000 spread)**, it still
discriminated, and Fable 5 finally got a real number. That's a signal you can rank on.
The handwriting scenario never was.

## The takeaway

Two headlines, and the second is the one that took me longer to accept.

**The pass-rate metric saturates and starts lying.** On a suite this deterministic, a
capability leaderboard would tell you Fable 5 is the best model here. Cost-per-fixed-task
tells you it's the most expensive way to get a 4/10, and that a previous-generation
Sonnet tied for the win at a fifth of the price. The right model for a job isn't the most
capable one; it's the cheapest one that clears the bar the job actually sets — and for
most of my agent's work, that bar was cleared a generation ago.

**But verify that your quality signal survives a second run before you rank anything on
it.** My cost axis was trustworthy the whole time — dollars are dollars. My *quality*
axis was noise wearing a lab coat: one non-deterministic scenario, a rubric that scored a
kid's spelling errors, a threshold sitting in the noise band, and a silent refusal booked
as a failure. A leaderboard that flips when you run it twice isn't a leaderboard. The
uncomfortable version of "don't trust benchmarks" is that it applies to the one you built
yourself.

I re-ran this expecting to write "the new models are better." I got "the new models
didn't matter," and then, digging further, "and half of what I used to decide that
doesn't reproduce." The dashboard made me write all three.
