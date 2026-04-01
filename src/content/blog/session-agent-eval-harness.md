---
title: "Session: Building an Agent Eval Harness"
description: "A fixed scenario suite with Prometheus instrumentation for comparing LLM models on real infrastructure automation tasks — built to survive a Claude Mythos upgrade."
pubDate: 2026-04-01
category: sessions
draft: false
---

Prompted by a Nate Jones video on preparing for model upgrades, this session builds a proper evaluation harness for the multi-agent infrastructure pipeline. The core question: when Claude Mythos (or whatever's next) drops, how do you know if your agent got better or worse?

Without a fixed test suite and stored baselines, that question has no scientific answer. You're just guessing.

## What we built

A 6-scenario eval suite — 2 happy path, 4 failure scenarios — instrumented with Prometheus metrics and a baseline JSON output format. It runs with a single command:

```bash
python cli.py eval --model anthropic/claude-haiku-4-5-20251001
```

Output: per-scenario console results, a timestamped `eval-baseline-YYYYMMDD-HHMMSS.json`, and Prometheus metrics pushed to the Pushgateway.

## The interesting architectural finding

Happy path scenarios produce exactly **0 LLM calls**. The LLM only activates in the `DIAGNOSING` state, which only fires on failure. This means the eval harness is almost entirely a measure of *failure diagnosis quality*, not general capability. If a new model is better at writing code but identical at diagnosing Terraform errors, this harness won't see the difference — and that's fine, because diagnosis is what this agent actually does.

## The 6 scenarios

| Scenario | What's broken | Diagnosis challenge |
|---|---|---|
| `lxc-happy-path` | Nothing | Validates infra health before failure runs |
| `vm-happy-path` | Nothing | Template clone path end-to-end |
| `fail-simple` | Wrong storage pool | Single clear error — 1 call sufficient |
| `fail-complex` | Wrong storage + ostemplate + bridge | 3 independent failure axes — does the model enumerate all, or anchor on one? |
| `fail-vm-simple` | Wrong template VMID (9999 vs 9000) | Distinct error vocabulary from storage errors |
| `fail-vm-complex` | Wrong template VMID + wrong storage | Both source and destination invalid |

## 4-model comparison results

| Model | Avg retries | Total cost | Cost/failure | Notable behavior |
|---|---|---|---|---|
| Haiku 4.5 | 2.0 | $0.0069 | $0.0017 | Stable, correct on simple failures; drifts into cluster topology speculation on VM scenarios |
| Sonnet 4.6 | 1.25 | $0.0863 | $0.0216 | 2% more tokens than Haiku, 13× more expensive; similar hypothesis quality |
| GPT-4o | 1.5 | $0.0748 | $0.0187 | 27% fewer tokens than Sonnet; only model to identify both root causes in `fail-vm-complex` |
| GPT-4o-mini | 2.25 | $0.0024 | $0.0006 | Near-identical token count to GPT-4o at 31× lower cost; shallower hypotheses |

The finding that surprised me: **Sonnet costs 13× more than Haiku and produces no measurable quality improvement on these specific failure types.** Haiku stays as the production diagnosis model.

## The Mythos Bar

For a future model to displace Haiku, it needs to clear at least two of:

1. Identifies all root causes in `fail-complex` on retry 1 — currently no model does this
2. Identifies both root causes in `fail-vm-complex` on retry 1 — GPT-4o found the storage error on retry 3
3. Resolves `fail-vm-simple` without cluster topology speculation (the "maybe it's on a different node" drift)
4. Token cost ≤ Haiku at equivalent hypothesis quality
5. <1% token variance across identical runs

If a model clears 1–3, the cost premium is worth evaluating. Cost only — Haiku stays.

Project: [Agent Eval Harness](/blog/project-agent-eval-harness)
