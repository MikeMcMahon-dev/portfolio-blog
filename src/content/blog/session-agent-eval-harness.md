---
title: "Session: Building an Agent Eval Harness"
description: "A fixed scenario suite with Prometheus instrumentation and baseline JSON output for comparing LLM models on real infrastructure automation tasks."
pubDate: 2026-04-01
category: sessions
draft: false
---

Prompted by a Nate Jones video on preparing for model upgrades, this session builds a proper evaluation harness for the multi-agent infrastructure pipeline.

The goal: a reproducible test suite that can tell us, before and after a model change, whether the agent is better or worse at diagnosing infrastructure failures.

**What we built:**

A 6-scenario eval suite — 2 happy path (LXC + VM), 2 LXC failure scenarios (simple/complex), 2 VM failure scenarios (simple/complex) — instrumented with Prometheus metrics and a baseline JSON output format.

**The interesting finding:**

Happy path scenarios produce exactly 0 LLM calls. The LLM only activates in the DIAGNOSING state, which only fires on failure. This means the eval harness is almost entirely a measure of *failure diagnosis quality*, not general capability.

**Model comparison (2026-04-01 baseline):**

| Model | Avg Retries | Success Rate | Avg Cost |
|---|---|---|---|
| claude-haiku-4-5 | 2.0 | 100% | $0.0003 |
| claude-sonnet-4-6 | 1.25 | 100% | $0.0021 |
| gpt-4o | 1.5 | 100% | $0.0089 |
| gpt-4o-mini | 2.25 | 100% | $0.0004 |

Sonnet resolves failures in fewer retries than Haiku. GPT-4o matches Sonnet's retry efficiency at 4× the cost. GPT-4o-mini is economical but needs more attempts.

Full architectural writeup: [eval-harness-architecture.md](/blog/project-agent-eval-harness)
