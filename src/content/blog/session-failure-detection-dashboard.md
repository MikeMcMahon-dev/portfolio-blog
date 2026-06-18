---
title: "Session: Building the Failure Detection Dashboard — Making AI Agent Costs Visible"
description: "The working session behind the Failure Detection Dashboard: standing up Prometheus + Pushgateway + Grafana for a batch eval harness, designing the metric labels, and the moment one panel revealed that a single OCR scenario was eating two-thirds of the budget."
pubDate: 2026-04-04
category: sessions
draft: false
---

I'd been running the multi-agent eval harness for a while before I admitted the
uncomfortable truth: I was flying blind. The harness ran 228 failure scenarios across
six models, dutifully emitting Prometheus counters the whole time — and I had no idea
where the cost or the failures actually concentrated. I knew the aggregate pass/fail
number. I knew nothing useful. This is the session where I built the lens that fixed
that, and the lens immediately showed me something I didn't want to see.

This is the build-story companion to the [Failure Detection Dashboard project
write-up](/blog/project-failure-detection-dashboard) — less "here's what it shows,"
more "here's how it got built and what surprised me along the way."

## The starting point: data with no view

The eval harness exercises a multi-agent system that runs Terraform through an LLM
diagnosis loop — if `terraform plan/apply` fails, an LLM proposes a fix, we retry up to
a cap. It was already instrumented. Counters were being emitted on every run. The
problem was purely one of visibility: the metrics existed, the dashboard didn't. The
data had been piling up for weeks with nobody looking at it through anything but
`grep`.

So the session had a clear shape: stand up a real monitoring stack, point it at the
harness, and design panels that answer the questions I actually had — *which scenarios
fail, and which ones cost money?*

## Decision one: Pushgateway, because the jobs don't stick around

The first real decision was the metrics transport, and it's the one most monitoring
tutorials get wrong for this use case. Prometheus is pull-based: it scrapes targets on
an interval. That's perfect for long-running services and useless for a batch eval run
that starts, emits its numbers, and exits in seconds. By the time Prometheus came
around to scrape it, the job would be gone.

The answer is the **Pushgateway** pattern (ADR-003 in my notes): the batch job *pushes*
its metrics to a gateway on completion, the gateway holds them, and Prometheus scrapes
the *gateway* on its normal interval. The job can live and die in two seconds; its
numbers persist. The whole stack ends up as a clean little pipeline:

```
eval harness ──push──> Pushgateway (9091) ──scrape 15s──> Prometheus (9090) ──> Grafana (3000)
```

A three-service `docker-compose` stood the whole thing up, with Prometheus configured
to scrape the Pushgateway job and Grafana provisioned with the datasource and dashboard
as code (the dashboard JSON lives in version control, not clicked together in a UI that
forgets).

## Decision two: the labels are the actual design work

Once the transport was settled, the dashboard's quality came down entirely to the
*label design* on four metric families:

```
eval_scenario_runs_total{scenario, model, status}        — outcomes
eval_scenario_tokens_total{scenario, model, token_type}  — input/output tokens
eval_scenario_cost_dollars_total{scenario, model}        — cumulative cost
eval_scenario_retries_total{scenario, model}             — retry attempts
```

This is the part that's easy to rush and expensive to get wrong. Get the labels right —
`scenario`, `model`, `status`, `token_type` — and almost every panel I'd want is just a
one-line PromQL aggregation over them. Get them wrong, and no amount of dashboard
cleverness recovers the dimension you didn't capture. Most of the thinking in this
session went here, not into the panels.

## The panel that taught me to throw out my first panel

My first instinct for the headline panel was a success-rate pie: SUCCESS vs FAILED. I
built it, it said 45.2%, and it looked like a dashboard. It was also nearly worthless —
"45% of runs pass" tells you *that* things fail, not *which* things fail or *why you
should care*. Aggregate health is a vanity metric.

So I rebuilt it as a stacked bar broken down `by(scenario, status)`, and the picture
immediately got useful: the happy-path baselines passed, the single-error scenarios
failed as designed, the cascading-failure scenarios hit the retry cap. Now I could see
shape, not just a number.

Then I added the cost-trend panel — cumulative dollars `by(scenario)` over time — and
that's the one that stopped the session cold. One line dominated the entire chart. Not
by a little. **A single scenario — OCR on a degraded 40-page geometry scan — was
consuming two-thirds of the entire $3.94 eval budget.** Everything else, all 200-plus
runs combined, was the noise floor under that one line.

## Following the smoking gun

The dashboard's whole job is to make that kind of thing visible in seconds, and then
hand you the thread to pull. Here's the thread:

- The geometry scenario forced a model strong enough to recover text from a bad scan.
  Only Sonnet cleared the 0.846 recovery threshold.
- Sonnet runs ~$5 per million input tokens. Forty pages at ~5,000 tokens each is
  ~200K input tokens — about **$1.00 per run**, and the comparative eval runs it twice.
- A `fail-simple` Terraform diagnosis, by contrast, is a Haiku call on ~800 tokens:
  roughly **$0.0005**. The geometry scenario was on the order of **4,000× more
  expensive** than a baseline diagnosis.

None of that was *wrong*, exactly — vision OCR on degraded scans is genuinely
expensive. What was wrong was that I hadn't known it, despite the harness emitting the
numbers the entire time. The cost wasn't a surprise because of bad luck; it was
inevitable. The surprise was how obvious it became the instant there was a panel
pointed at it.

## What changed because of it

A dashboard that only tells you you're bleeding money isn't worth much; the point is
what it lets you fix. This one drove concrete routing decisions:

- **Route models by error class.** Simple/printed/text-layer work goes to Haiku;
  Sonnet is reserved for handwritten or genuinely cascading cases. Don't pay Sonnet
  rates to read a clean PDF.
- **Don't OCR 40-page PDFs page-by-page through a frontier model.** That one scenario
  is now a standing cautionary tale.
- **Treat the happy path as the alerting baseline.** 105 runs, zero LLM calls, $0.00 —
  that's the floor. If happy-path success ever drops below ~99%, something regressed,
  and the dashboard will show it before the bill does.

## The takeaway

Two things stuck with me from this session. The narrow one: with a batch workload, the
transport decision (Pushgateway over pull-scraping) and the label design matter far more
than panel polish — get those right and the dashboard nearly builds itself. The broad
one: observability isn't about preventing failures, it's about making them *visible and
cheap*. My agent had been quietly spending two-thirds of its budget on one scenario for
weeks, and the fix wasn't smarter agents — it was finally building the fifteen-second
view that made the waste impossible to miss.

The metrics had been there all along. What was missing was the discipline to stop and
look at them.
