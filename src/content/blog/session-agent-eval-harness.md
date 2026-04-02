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

**Model comparison (2026-04-01 baseline, 5 models):**

| Model | Avg retries | Total cost | Cost/failure | Notable behavior |
|---|---|---|---|---|
| claude-haiku-4-5 | 2.0 | $0.0069 | $0.0017 | Stable, correct on simple failures; topology speculation on VM scenarios |
| claude-sonnet-4-6 | 1.25 | $0.0863 | $0.0216 | Fewest retries; 13× Haiku's cost for similar hypothesis quality |
| gpt-4o | 1.5 | $0.0748 | $0.0187 | 27% fewer tokens than Sonnet; only model to find both root causes in fail-vm-complex |
| gpt-4o-mini | 2.25 | $0.0024 | $0.0006 | Near-identical token count to GPT-4o at 31× lower cost; shallower hypotheses |
| **claude-opus-4-6** | **2.25** | **$0.394** | **$0.099** | Same retry behavior as Haiku; drifts to topology speculation; 57× Sonnet's cost |

Opus 4.6 was run after the initial 4-model baseline as a sanity check on the top of the Anthropic lineup. It did not clear the Mythos Bar — retry behavior was identical to Haiku and GPT-4o-mini, it still speculated about cluster topology on `fail-vm-complex` by retry 3, and it costs $0.099 per failure scenario vs Haiku's $0.0017. There is no justification for using it here.

**Haiku stays as the production diagnosis model.**

Full architectural writeup: [eval-harness-architecture.md](/blog/project-agent-eval-harness)
