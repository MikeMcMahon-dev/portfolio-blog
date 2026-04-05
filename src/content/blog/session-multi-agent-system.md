---
title: "Session: Multi-Agent Infrastructure Automation"
description: "Building a 3-agent Planner/Terraform/Validator pipeline that diagnoses its own failures using LLM reasoning."
pubDate: 2026-03-22
category: sessions
draft: false
---

*Full write-up coming soon.*

The multi-agent-lab is a 3-agent pipeline for Proxmox infrastructure automation: a Planner orchestrates intent, a Terraform sub-agent applies it, and a Validator sub-agent inspects results. When something fails, the Planner uses LLM diagnosis to form a hypothesis and retry.

Key design decisions:
- LLM calls only happen in the DIAGNOSING state — zero LLM calls on clean runs
- Hypothesis deduplication prevents circular reasoning loops
- Prometheus metrics with scenario + model labels for observability
- Supports LXC containers and VM clones via separate Terraform modules
