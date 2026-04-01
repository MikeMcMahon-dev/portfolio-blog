---
title: "Project: Multi-Agent Infrastructure Automation"
description: "A 3-agent Planner/Terraform/Validator pipeline for Proxmox homelab automation with LLM-powered failure diagnosis."
pubDate: 2026-03-22
category: projects
draft: false
---

The multi-agent-lab is a production-grade experiment in agentic infrastructure automation. The core insight: infrastructure failures are often diagnosable from their error messages, and an LLM is surprisingly good at that diagnosis when given structured context.

**Pipeline:**
1. **Planner** — receives a task specification, breaks it into steps, orchestrates the pipeline
2. **Terraform sub-agent** — applies infrastructure changes via `terraform plan/apply`
3. **Validator sub-agent** — inspects results and reports pass/fail with structured output

On failure, the Planner enters DIAGNOSING state: it sends the error to an LLM, forms a hypothesis, mutates the Terraform variables, and retries. Hypothesis deduplication prevents loops.

**Key design properties:**
- Zero LLM calls on clean runs (LLM only activates on failure)
- Prometheus metrics for observability
- Supports Proxmox LXC containers and VM clones
- Full eval harness for model comparison

**Status:** Active development. Used for homelab LXC and VM provisioning.

Session notes: [Multi-Agent System](/blog/session-multi-agent-system) · [Agent Eval Harness](/blog/session-agent-eval-harness)
