---
title: "Session: Context Preservation Across AI Sessions"
description: "Building the memory and session-wrap infrastructure that makes long-running AI-assisted projects tractable."
pubDate: 2026-03-28
category: sessions
draft: false
---

AI-assisted development has a specific failure mode that nobody talks about enough: context loss mid-project. Not within a session — between them. You come back after a day away, start fresh, and spend the first 20 minutes re-explaining architecture before you can make real progress. At scale, across multiple sub-projects running in parallel, this becomes the primary drag on velocity.

This session builds a three-layer defense against it. The layers are independent — any one of them survives the others failing.

---

## The Problem in Concrete Terms

By late March, the home-lab project had four active sub-projects:

- `open-brain/` — production RAG system, live on Vercel, Annie using it daily
- `multi-agent-lab/` — 3-agent Planner/Terraform/Validator with real Proxmox infrastructure
- `agent-lab/` — first-gen automation experiments, partially archived
- `homelab-talos-cluster/` — Talos K8s node provisioning, separate lifecycle

Each project had different production state, different constraints, different in-flight work. Claude Code's context compression was already kicking in on long sessions — truncating earlier parts of the conversation to fit the context window. The risk: a compressed session loses the "why" behind a design decision, recommends the thing that was explicitly rejected, or forgets the production constraint that made the obvious approach wrong.

Three layers. The first is automatic. The second is procedural. The third requires no tooling at all.

---

## Layer 1: Hooks

Claude Code hooks execute shell commands in response to lifecycle events. Four hooks cover the critical transitions:

**`SessionStart`** — fires on fresh session open. Automatically runs `labtime.sh start` to begin time tracking. Zero manual overhead.

**`UserPromptSubmit`** — `session_guard.py` runs on every prompt. Two checks: stale session warning if more than 3 hours have elapsed since the last stop (you left without wrapping), and an hourly brain commit reminder so context gets ingested before it's lost.

**`PreCompact`** — fires *before* Claude Code compresses the conversation. The hook ingests key decisions, constraints, and in-progress work into OpenBrain before the context window shrinks. The ingested content survives the compression.

**`PostCompact`** — fires after compression. The hook ingests a summary of the compressed context into OpenBrain as a fallback record.

PreCompact and PostCompact together mean compression isn't destructive — the important parts go to the knowledge store before they're summarized away.

---

## Layer 2: Skills (Procedural)

Hooks are automatic but limited — they run shell scripts, not Claude logic. Skills fill the gap.

**`/commit`** — enforces the feature branch workflow. If the current branch is `main`, it creates a feature branch before committing. Commits, pushes, opens a PR. The entire workflow in one command, with no opportunity to accidentally push to main.

This matters because the git workflow is non-negotiable: all changes go to a feature branch → PR → merge. No exceptions. Having an automated skill that enforces it means it happens even when you're moving fast at the end of a session.

**`/wrap`** — the end-of-session ritual, in sequence: commit any open work → log labtime stop with a summary → update `ai-engineering-plan/CURRENT_STATE.md` → ingest a session summary to OpenBrain → update `OPENBRAIN_NEXT_STEPS.md` with follow-on tasks.

Running `/wrap` means the next session starts with an accurate state document, a fresh brain entry, and a clean git state. The cold start overhead drops to near zero.

---

## Layer 3: CLAUDE.md + ADRs (Zero-Dependency)

Hooks and skills both depend on Claude Code being configured correctly and the OpenBrain MCP being reachable. Layer 3 has no dependencies — it's just files in the repo.

Each active project got a `CLAUDE.md` at its root:

- `open-brain/CLAUDE.md` — production state, environment constraints, file map, dev workflow, smoke test command
- `multi-agent-lab/CLAUDE.md` — Proxmox API details, state machine transitions, MinIO backend endpoint, model config path
- `agent-lab/CLAUDE.md` — Phase 1 state, guardrail design, what's archived and why

Architecture decisions across all three projects were documented as ADRs in `docs/decisions/`. 11 ADRs total. Each one records the decision, the alternatives considered, and the reasoning — so the "why" is available even when context is lost.

A new Claude Code session reading `open-brain/CLAUDE.md` knows it's looking at a production system with 26/26 smoke tests green, that `/ingest` and `/query` require bearer token auth, and exactly which file contains the Socratic teaching rules. Without asking. Without re-explaining.

---

## Memory Consolidation

The OpenBrain MCP bucket structure had drifted: six separate entries across different namespaces, some stale, some contradictory. This session consolidated them into the home-lab bucket — single source of truth, single namespace to query.

The `user_profile.md` auto-memory entry was expanded with the full Mike profile: military background (Marine Corps, 0331 machinegunner), career arc (infrastructure/SRE at Rockwell), family (Beth, Annie), collaboration context (Dan Lee, the AI-assisted velocity conversation). First-session context without a first-session re-introduction.

---

## What This Changes

The practical test: start a session after a week away. The `SessionStart` hook fires, `openbrain_query` returns recent project state, `CLAUDE.md` is loaded automatically. By the time the first prompt is typed, the model has current production state, architectural constraints, and relevant decisions — without being told any of it.

That's the baseline this infrastructure sets. The cold-start tax is real. These three layers eliminate most of it.

Session notes: [OpenBrain project overview](/blog/project-openbrain) | [Building OpenBrain](/blog/session-building-openbrain)
