---
title: "Project: Agent Lab — Phase 1"
description: "The foundation: a controlled infrastructure execution agent with LLM-assisted diagnosis, strict guardrails, and Prometheus observability."
pubDate: 2026-03-01
category: projects
draft: false
---

Agent Lab is where the agentic infrastructure work started. The goal was deliberately constrained: not autonomous infrastructure mutation, but **controlled, observable, policy-bound AI-assisted execution**.

That constraint turned out to be the right call. It forced clarity about what the LLM actually needs to do versus what deterministic code handles better.

## What it does

Agent Lab drives a state machine for Terraform-based infrastructure deployment:

```
INIT → PLAN → APPLY → DIAGNOSE → APPROVAL → RETRY → SUCCESS/FAILED
```

On failure, diagnosis can be deterministic (regex pattern matching against known error signatures) or LLM-based. LLM output is constrained to a strict JSON schema — the agent can't emit free-form text and have it treated as instruction.

Tool execution is constrained to a defined `ToolRegistry`. The agent cannot call tools outside the registry. This is the "policy-bound" part of controlled execution — the LLM can reason about what to do, but it can only act through pre-approved channels.

## Why the guardrails matter

The framing I keep coming back to: an LLM doing infrastructure work without guardrails is a very expensive way to have a bad day. The retry cap, hypothesis deduplication, and human approval gate aren't just safety theater — they're the difference between "the agent tried something wrong and stopped" and "the agent kept trying wrong things until it did real damage."

Hypothesis deduplication is the underappreciated one. If the LLM proposes the same fix twice, the run terminates. Without it, a model that gets stuck generates circular reasoning that burns tokens without making progress.

## Observability

Every LLM call emits metrics to Prometheus Pushgateway:

- input/output tokens
- latency
- model name
- call count
- retry count
- success/failure outcome

This telemetry is what made the multi-agent-lab eval harness possible — we had real calibration data from the start.

## Status

Phase 1 complete. The multi-agent-lab extends this foundation with a 3-agent architecture, Pydantic handoff contracts, and production Proxmox deployment.

Project: [Multi-Agent Lab](/blog/project-multi-agent-lab)
