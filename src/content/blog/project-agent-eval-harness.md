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

**2026-04-01 baseline results (5 models):**

| Model | Avg retries | Total cost | Cost/failure | Notable |
|---|---|---|---|---|
| claude-haiku-4-5 | 2.0 | $0.0069 | $0.0017 | Stable baseline — production model |
| claude-sonnet-4-6 | 1.25 | $0.0863 | $0.0216 | Fewest retries; 13× Haiku cost |
| gpt-4o | 1.5 | $0.0748 | $0.0187 | Only model to find both root causes in fail-vm-complex |
| gpt-4o-mini | 2.25 | $0.0024 | $0.0006 | Cheapest; hypothesis depth slightly shallower |
| claude-opus-4-6 | 2.25 | $0.394 | $0.099 | Did not clear Mythos Bar; 57× Sonnet cost, same retry behavior |

Opus 4.6 was added after the initial 4-model run. It matched Haiku's retry count, reproduced the same cluster topology speculation failure on `fail-vm-complex`, and cost 57× more than Sonnet. Haiku remains the production diagnosis model.

Session notes: [Agent Eval Harness](/blog/session-agent-eval-harness)
