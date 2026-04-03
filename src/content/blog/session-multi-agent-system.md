---
title: "Session: Multi-Agent Infrastructure Automation"
description: "Building a 3-agent Planner/Terraform/Validator pipeline that diagnoses its own failures using LLM reasoning — deployed against live Proxmox infrastructure."
pubDate: 2026-03-28
category: sessions
draft: false
---

The question that kicked this off: what's the difference between an agent that *uses* infrastructure tools and a system that can *reason* about infrastructure failures?

The answer turned out to be a state machine, Pydantic contracts, and a very specific rule about when the LLM is allowed to speak.

---

## Where it Started: agent-lab

[agent-lab](/blog/project-agent-lab) was Phase 1 — a single monolithic agent that could execute Terraform tasks and handle simple failures. It worked, but it had the architecture of a prototype: ad-hoc state management, free-form dictionaries passing between components, LLM involvement on every iteration.

The multi-agent-lab is what happens when you take that prototype seriously.

---

## The Architecture

Three agents. One state machine. LLM only when things break.

```
Planner (state machine)
    │
    ├── TerraformRequest ──► Terraform sub-agent (plan + apply, no LLM)
    │                                │
    │                        TerraformResult
    │                                │
    ├── ValidationRequest ──► Validator sub-agent (4 checks, no LLM)
    │                                │
    │                        ValidationResult
    │                                │
    └── on failure ──► diagnosis/llm.py (LLM called here, nowhere else)
```

The Planner is the orchestrator — it owns the state machine and makes all routing decisions. The Terraform and Validator sub-agents are deterministic: no LLM, no judgment calls. They execute and report. The LLM only enters when the Planner is in the `DIAGNOSING` state — which only happens after a real failure.

The state machine transitions:

```
INIT → RUNNING → VALIDATING → SUCCESS
              ↓           ↓
          DIAGNOSING ◄───┘
              ↓
    RUNNING (retry)  or  FAILED
```

`FAILED` triggers when retry count hits the cap, or when the LLM produces the same hypothesis twice — hypothesis deduplication prevents circular reasoning loops.

---

## The Decision That Changed the Economics

**ADR-001: LLM invoked only on failure.**

This wasn't obvious at the start. The original instinct was to have the LLM validate the plan before applying it — review the Terraform before execution, catch issues proactively. It sounds reasonable.

The problem: that means an LLM call on every run, even when everything works. You're paying for reasoning on clean infrastructure that doesn't need reasoning.

The better model: trust the deterministic layers. Terraform and the Validator are good at what they do. Let them run. The LLM earns its API call only when something breaks and you need a hypothesis.

Result: **$0.00 on every clean run.** The LXC fleet deployment — 5 containers simultaneously — cost nothing in LLM calls because it worked. The VM deployment cost nothing. The cost shows up only when there's an actual failure to diagnose, and then it's ~$0.0004–0.0005 per incident with Haiku.

---

## The Provider Migration — The First Real Diagnosis Test

The first real LLM diagnosis in production wasn't a scripted failure scenario. It was a genuine infrastructure problem.

The original Terraform modules used `telmate/proxmox` (~2.9) — the most common Proxmox provider. It worked fine in the docs. It did not work fine in practice against Proxmox VE 9.x. The resource type `proxmox_lxc` kept throwing permission-check errors.

The LLM diagnosed it on the first hypothesis: the `proxmox_lxc` resource type in telmate doesn't map correctly to Proxmox 9.x's API. The correct resource is `proxmox_virtual_environment_container` from `bpg/proxmox` (~0.73), which is actively maintained.

ADR-002 documents the migration. But the more interesting thing is what the diagnosis looked like in practice: the agent received the stderr, the state log, and the module config — full context, no filtering — and produced a specific, correct hypothesis on the first call. Not "try reinstalling the provider." The actual root cause.

Cost: **$0.0005.**

The second real diagnosis came from a Validator regex issue: the pattern was looking for `proxmox_lxc[0]` in the state output, but after the migration to bpg, the state key was `container[0]`. Again: first hypothesis, correct, $0.0004.

Two real failures in production. Two first-hypothesis successes. That's the baseline.

---

## Remote State on StanzaLab

Terraform state needed a home. The options were local (fragile), cloud S3 (external dependency), or self-hosted. ADR-003: MinIO on StanzaLab — the QNAP NAS on the homelab network — as an S3-compatible backend.

Standard Terraform S3 backend config works unchanged. State is locked during apply (crash-safe). No cloud dependency. The only caveat: if StanzaLab is offline, `terraform plan` won't run. That's an acceptable tradeoff for a homelab system that's not running 24/7 production deployments.

---

## What Was Actually Deployed

Not a simulation. Live infrastructure on `pmx-01`.

| Run | What deployed | LLM calls | Cost |
|---|---|---|---|
| LXC single box | Debian 13, VMID 901 | 0 | $0.00 |
| LXC fleet | 5× Debian 13, VMIDs 901–905 | 0 | $0.00 |
| Ubuntu VM | Ubuntu 24.04 clone from template 9000 | 0 | $0.00 |

The Ubuntu VM module required building a cloud image template first — VMID 9000, `noble-server-cloudimg-amd64.img`, with `qemu-guest-agent` baked in (Terraform retrieves IPs via guest agent), cloud-init cleaned, SSH host keys removed. That template now lives on pmx-01 and is the standard clone source for any VM deployment.

---

## What the eval harness added

A separate session (2026-04-01) extended the multi-agent harness with a formal evaluation framework. Six fixed scenarios — 2 happy path, 4 failure scenarios — run across multiple models with Prometheus instrumentation. That work is documented in [Session: Building an Agent Eval Harness](/blog/session-agent-eval-harness).

The interesting finding from the eval: happy path produces exactly 0 LLM calls, which means the eval is almost entirely a measure of *failure diagnosis quality*. The harness doesn't test whether the agent can deploy infrastructure. It tests whether the agent can figure out why it broke.

---

## The bigger point

Most AI infrastructure demos show an agent that executes commands. This one shows an agent that has a separation between what it does deterministically and what it reasons about — and knows which is which.

That distinction matters more as these systems get more capable. The question isn't whether the LLM *can* evaluate every Terraform plan. It's whether it *should*. The answer here is: only when there's something worth reasoning about.

Project notes: [Multi-Agent Infrastructure Automation](/blog/project-multi-agent-lab)
