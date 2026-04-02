---
title: "The Plan: AI Implementation Architect Portfolio"
description: "A structured 4-project lab plan targeting AI Implementation Architect / Staff Engineer readiness — mapped directly to Nate Jones's 7 employer-cited AI skills."
pubDate: 2026-04-02
category: projects
draft: false
---

In early 2026, Nate B. Jones published an analysis of hundreds of AI job postings and identified something specific: the AI job market had split. Generalist "AI users" were competing for commodity roles. A much smaller group — people who could design, build, operate, and validate agentic systems — were getting $280K–$400K+ offers with 142-day average time-to-fill because there simply weren't enough of them.

He distilled it to 7 skills that employers were explicitly hiring for. My collaborator Dan Lee and I mapped those skills against what I'd already built and what was missing, and turned the gap analysis into a build plan.

## The gap analysis

| Skill | Status going in |
|---|---|
| Specification Precision | Strong — already natural |
| **Evaluation & Quality Judgment** | **Gap — biggest priority** |
| **Multi-Agent Task Decomposition** | **Theory only — not built** |
| Failure Pattern Recognition | Partial — not explicit |
| Trust & Security Design | Strong — agent-lab guardrails |
| Context Architecture | Strong — OpenBrain is this |
| Cost & Token Economics | Foundation exists, incomplete |

## The four projects

**Project 1 — Eval Harness for OpenBrain** *(addresses: Evaluation & Quality Judgment)*

A systematic eval framework measuring whether OpenBrain's AI responses are actually correct — not just fluent. Two independent judges (Claude Sonnet + GPT-4o), hallucination detection, longitudinal tracking. Nate's framing: *"Resisting the temptation to read fluency as correctness."* Baseline: 0.950 average fidelity across 25 test cases, 98/100 query pass rate.

**Project 2 — Multi-Agent Infrastructure Automation** *(addresses: Multi-Agent Task Decomposition)*

A real working 3-agent system: Planner → Terraform sub-agent → Validator sub-agent. Explicit Pydantic handoff contracts, deterministic state machine, LLM only on failure. Deployed against live Proxmox infrastructure. ✅ Complete — exceeded scope.

**Project 3 — Failure Pattern Detection Dashboard** *(addresses: Failure Pattern Recognition)*

Explicit instrumentation for the six AI failure modes Nate identified: context degradation, specification drift, sycophantic confirmation, tool selection errors, cascading failure, and silent failure. Prometheus counters + Grafana dashboard + failure injection test suite. Not started.

**Project 4 — Token Economics Calculator** *(addresses: Cost & Token Economics)*

A Python CLI that projects AI task costs across models before committing to a run, calibrated against actual agent-lab telemetry. Not started.

## Where things stand (2026-04-01)

Week 2 (multi-agent) is complete and beyond scope. The eval harness for OpenBrain is ~90% done. The agent eval harness built on 2026-04-01 is a direct descendant of both — a fixed scenario suite for model comparison that's now part of the standard toolkit for any future model upgrade.

Projects 3 and 4 are next. The Prometheus infrastructure from projects 1 and 2 means Project 3 is mostly instrumentation and visualization work on top of an existing foundation.

The portfolio framing when complete: *"I built a production RAG system, instrumented it with systematic evals, extended the infrastructure agent to multi-agent orchestration, explicitly detect and classify failure modes in real time, and can model the economics of any of it before spending a token."*

That's not a candidate who uses AI. That's a candidate who builds AI systems — and can prove they work.
