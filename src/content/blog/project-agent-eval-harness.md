---
title: "Project: Agent Eval Harness"
description: "A fixed scenario suite with Prometheus instrumentation for comparing LLM models on real infrastructure automation tasks."
pubDate: 2026-04-01
category: projects
draft: false
---

When a new model drops — Claude Mythos, GPT-5, whatever's next — how do you know if your agent got better or worse?

The agent eval harness answers that question with reproducible data.

**Scenario suite (6 fixed scenarios):**

| Scenario | Type | Expected |
|---|---|---|
| lxc-happy-path | LXC provision | 0 LLM calls, SUCCEEDED |
| vm-happy-path | VM clone | 0 LLM calls, SUCCEEDED |
| fail-simple | Wrong storage pool | SUCCEEDED via diagnosis |
| fail-complex | Storage + template + bridge wrong | SUCCEEDED via diagnosis |
| fail-vm-simple | Bad template VMID | SUCCEEDED via diagnosis |
| fail-vm-complex | Bad VMID + bad storage | SUCCEEDED via diagnosis |

**Metrics (Prometheus):**
- `eval_scenario_runs_total` — labeled by scenario, model, status
- `eval_scenario_tokens_total` — input/output token counts
- `eval_scenario_cost_dollars_total` — USD cost per scenario
- `eval_scenario_retries_total` — retry count (proxy for diagnosis difficulty)

**2026-04-01 baseline results:**

| Model | Avg Retries | Avg Cost |
|---|---|---|
| claude-haiku-4-5 | 2.0 | $0.0003 |
| claude-sonnet-4-6 | 1.25 | $0.0021 |
| gpt-4o | 1.5 | $0.0089 |
| gpt-4o-mini | 2.25 | $0.0004 |

Sonnet resolves failures in fewer retries. GPT-4o matches but costs 4×. Haiku is the budget option with a reliability trade-off.

Session notes: [Agent Eval Harness](/blog/session-agent-eval-harness)
