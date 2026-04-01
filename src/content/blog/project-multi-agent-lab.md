---
title: "Project: Multi-Agent Infrastructure Automation"
description: "A 3-agent Planner/Terraform/Validator pipeline for Proxmox homelab automation with LLM-powered failure diagnosis. Zero LLM calls on clean runs."
pubDate: 2026-03-22
category: projects
draft: false
---

The multi-agent-lab is a production-grade experiment in agentic infrastructure automation. It provisions real infrastructure on a Proxmox homelab cluster — LXC containers and VM clones — using a 3-agent pipeline where the LLM only activates when something goes wrong.

## Architecture

```
                ┌─────────────────────────────────────────┐
                │               Planner                    │
                │   (deterministic state machine)          │
                │                                          │
                │  INIT → RUNNING → VALIDATING → SUCCESS   │
                │              ↓           ↓               │
                │          DIAGNOSING ← ─ ─                │
                │              ↓                           │
                │          RUNNING (retry) or FAILED       │
                └─────────────────────────────────────────┘
                       │                    │
           TerraformRequest        ValidationRequest
                       │                    │
                ┌──────▼──────┐    ┌────────▼────────┐
                │  Terraform  │    │    Validator     │
                │  sub-agent  │    │    sub-agent     │
                │ plan+apply  │    │  4 checks        │
                │  (no LLM)   │    │  (no LLM)        │
                └──────┬──────┘    └────────┬─────────┘
                       │                    │
                ┌──────▼────────────────────▼──┐
                │         diagnosis/llm.py      │
                │   (called ONLY on failure)    │
                │   Anthropic or OpenAI API     │
                └───────────────────────────────┘
```

The key design insight: infrastructure provisioning is almost entirely deterministic. There's no reason to burn tokens on clean runs. The LLM activates exclusively in the `DIAGNOSING` state — which only fires on failure.

## State machine

| Transition | Trigger |
|---|---|
| INIT → RUNNING | Task received |
| RUNNING → VALIDATING | Terraform apply succeeds |
| VALIDATING → SUCCESS | All 4 checks pass |
| RUNNING → DIAGNOSING | Terraform apply fails |
| VALIDATING → DIAGNOSING | Any check fails |
| DIAGNOSING → RUNNING | New hypothesis, retry count < cap |
| DIAGNOSING → FAILED | Retry cap hit or repeated hypothesis |

Hypothesis deduplication prevents circular reasoning loops. If the LLM proposes the same fix twice, the run terminates rather than spinning.

## Infrastructure modules

Both modules use the **bpg/proxmox** provider (~0.73). The telmate/proxmox provider (~2.9) was evaluated and rejected — unmaintained, with known permission-check bugs against Proxmox VE 9.x.

| Module | What it deploys |
|---|---|
| `proxmox-lxc` | Debian 13 LXC containers, DHCP, count support |
| `proxmox-vm` | Ubuntu 24.04 VM clones from template VMID 9000, cloud-init, SSH |

Terraform remote state is stored on MinIO running on a QNAP NAS (StanzaLab) — S3-compatible, self-hosted, no cloud dependency.

## Observability

Every LLM diagnosis call pushes metrics to a Prometheus Pushgateway:

| Metric | Labels |
|---|---|
| `agent_llm_cost_dollars_total` | model |
| `agent_llm_input_tokens_total` | model |
| `agent_llm_output_tokens_total` | model |
| `agent_llm_calls_total` | model |
| `agent_llm_latency_seconds` | model |

## Production results

All real-world failures to date were diagnosed correctly on the first hypothesis. LLM first-hypothesis success rate: 100%.

| Run | Result | Retries | LLM cost |
|---|---|---|---|
| LXC single container | SUCCESS | 0 | $0.00 |
| LXC 5-container fleet | SUCCESS | 0 | $0.00 |
| Ubuntu VM clone | SUCCESS | 0 | $0.00 |

## Eval harness

A fixed 6-scenario eval suite measures diagnosis quality across models. 2026-04-01 baseline:

| Model | Avg retries (failure scenarios) | Avg cost |
|---|---|---|
| claude-haiku-4-5 | 2.0 | $0.0003 |
| claude-sonnet-4-6 | 1.25 | $0.0021 |
| gpt-4o | 1.5 | $0.0089 |
| gpt-4o-mini | 2.25 | $0.0004 |

Sonnet diagnoses failures in fewer retries than Haiku. GPT-4o matches Sonnet's retry efficiency at 4× the cost.

Session notes: [Multi-Agent System](/blog/session-multi-agent-system) · [Agent Eval Harness](/blog/session-agent-eval-harness)
