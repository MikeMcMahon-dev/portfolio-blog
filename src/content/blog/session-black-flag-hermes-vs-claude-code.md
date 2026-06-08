---
title: "Session: Hermes vs Claude Code — Project Black Flag"
description: "A controlled experiment: two AI agents, one infrastructure deployment task, same Proxmox home lab. Hermes took 10 hours and $75+. Claude Code took 3 hours and $40. Here's what actually happened."
pubDate: 2026-06-07
category: sessions
draft: false
---

## The Why: Movies That Go BOOM

I have a home theater setup built for the experience. Not the streaming experience — the experience of watching *Oppenheimer* at reference volume with a subwoofer that reminds you your house is made of wood. Streaming services apply audio compression by default. That compression is a deliberate choice by the platform, and if you've trained your ears to notice it, you can't un-notice it.

The workaround is Blu-ray. The problem with Blu-ray is that it requires locating a physical disc, which in practice means knowing which shelf it's on, which case it's actually in, and whether the kids touched it. I own the disc. I want to watch the movie. These should not be in conflict.

That's the premise behind Project Black Flag: a self-hosted media automation stack that lets me rip discs to a NAS and serve them to any screen in the house through Jellyfin. VPN-enforced. Fully automated. No hunting for plastic.

## The Stack

The deployment target was a Proxmox VM running the following in Docker Compose:

- **Gluetun** — VPN gateway (OpenVPN/PIA), running as the network namespace for all transfer traffic
- **qBittorrent** — download client, network-namespaced inside Gluetun
- **Prowlarr** — indexer manager
- **Radarr / Sonarr** — movie and TV automation
- **Bazarr** — subtitle automation
- **Jellyseerr** — user request portal
- **Jellyfin** — media server
- **FlareSolverr** — Cloudflare bypass for indexers

The hard requirement: **VPN must be active before any data transfers occur.** This is enforced architecturally by running qBittorrent inside Gluetun's network namespace — not via an application-level kill switch, which can fail. If Gluetun is down, qBittorrent has no network path. Done.

The question wasn't whether the stack could be deployed. The question was which agent could deploy it better.

## The Experiment

I'd recently come across Hermes — a multi-AI capable agent wrapper, discovered through a NetworkChuck video. For this experiment I pointed it at my Claude subscription for simplicity, running Sonnet 4.6. Hermes integrates with existing Claude tooling: it picked up OpenBrain MCP and my session start/end rules without any special configuration. I spent some time establishing operating constraints with it before putting it to real work.

The experiment was straightforward: give Hermes and Claude Code the same task — deploy the full Black Flag stack in my Proxmox home lab — and compare the outcomes on speed, cost, autonomy, and correctness.

Two agents. One task. One lab environment.

---

## Round 1: Hermes

### What Happened

Hermes started at 12:16 PM and wrapped up around 10:00 PM the same day. Total active work time: approximately 10 hours across three sessions. (The session timestamp logged as 14:54 the following day — that's when it was finally closed, not when the work ended. A preview of the /wrap problem.)

It hit significant roadblocks mid-session:

- The Pi-hole LXC container needed to be rebuilt due to a missing VLAN tag — an environmental issue, not an agent failure, but it consumed time
- Cloud-init issues on the new VM caused a long debugging spiral
- Several clarifying questions surfaced mid-session that should have been resolved in the spec upfront: VPN provider credentials, NAS mount details, PUID/PGID values, SSH key placement

Post-deployment, Hermes left application configuration to the operator. The containers were running. The applications were not configured.

### The Numbers

Approximately **17.7 million tokens** across three sessions, with no Anthropic prompt caching in use. Every message turn re-sent the full context at standard input pricing ($3/Mtok).

One session ran 5+ hours with 294 messages and 130 tool calls. That's a massive context re-send cost on every single turn. Hermes hit the Claude.ai "extra usage" limit mid-session — required $75+ in additional credits to complete the work.

One session also ran unclosed, logging as "6.5 days" in duration. No `/wrap` discipline, no checkpoint state — just an unbounded context growing in the background.

### Observations

Hermes felt slow. Not sluggish in individual responses, but slow in aggregate — the lack of checkpoint discipline meant sessions kept running rather than summarizing and handing off. Context bloat degraded performance noticeably in the longer sessions.

Strong at orchestration. Weak at knowing when to stop, checkpoint, and resume clean.

---

## Round 2: Claude Code

### What Changed

Before handing the task to Claude Code, I fixed the spec. Hermes surfaced the gaps immediately — VPN provider and credentials, NAS IP and mount path, target VM IP, SSH key location, PUID/PGID, preferred media directory structure — not buried mid-session, but right after being handed the initial brief. Those were spec failures, not agent failures. I patched them before the v2 run.

Code got a tighter spec because the original spec was incomplete. That's not giving Code an advantage — it's correcting the inputs so the experiment could actually run. I'll come back to what that distinction means for the comparison.

Code was run with `--dangerously-skip-permissions` for autonomous operation on a dedicated lab VM.

### What Happened

Wall clock time: **~3 hours** (15:49 → 18:50 MDT). Four context windows, mostly autonomous.

Before touching any configuration, Code surfaced **7 gaps** in a structured list and waited for answers. That's the behavior difference in one sentence: Hermes discovered gaps by running into them; Code identified them before starting.

The human interventions that did occur were operator errors:

- A legacy IP address in a config file that I hadn't updated
- An NFS ACL that needed updating for the new VM IP — I hadn't provisioned it
- Proxmox host memory exhaustion (more on that below)

After deployment, Code configured the applications autonomously — qBittorrent settings, Jellyfin library scan, Jellyseerr onboarding. Then it submitted a test request for *The Matrix* to validate the end-to-end pipeline.

Nobody's gonna argue with The Matrix.

6.4GB downloaded, appeared in the Jellyfin library, playback confirmed. End-to-end functional.

### The Numbers — Deployment Session

```
Input:        17,649 tokens     $0.05
Output:      656,372 tokens     $9.85
Cache write: 1,150,196 tokens   $4.31
Cache read:  64,232,502 tokens  $19.27
Total:                          ~$33.48
```

That cache read line is the key finding. **64 million tokens at $0.30/Mtok** — versus Hermes re-sending the same context at $3/Mtok on every turn. Claude Code's prompt caching kept the system prompt, tool schemas, and accumulated context in cache across turns. The architecture of how the agent manages context is a direct cost multiplier.

### The Numbers — Incident Response Session

After the deployment, black-flag2 started shutting down unexpectedly. Code had provisioned 16GB RAM per the spec's recommended value — which was correct per the spec. What neither the spec nor Code knew: the Proxmox host has 30GB of physical RAM and was already running 11 other VMs. Total allocated RAM across all VMs: ~62GB against 30GB physical. Both black-flag instances were suffering from host OOM pressure.

Code diagnosed this, identified the overprovisioning, resized black-flag2 from 16GB to 8GB, and verified stack recovery:

```
Input:            182 tokens     $0.00
Output:       133,478 tokens     $2.00
Cache write:  350,438 tokens     $1.31
Cache read: 11,360,629 tokens    $3.41
Total:                           ~$6.73
```

Cache-read dominance again. The incident session built up diagnostic context quickly, and that context re-read efficiently on each subsequent turn.

One note on cost attribution: there's no clean way to isolate "how much did the overprovisioning rabbit hole cost specifically" without per-request token logging, which Claude Code doesn't expose by default. The $6.73 is the full incident session figure. This is itself a finding — **agentic cost attribution is coarse-grained.** You know the session total, not the per-decision cost.

### Total Claude Code Cost

| Session | Cost |
|---|---|
| Deployment | ~$33.48 |
| Incident response (OOM / stability) | ~$6.73 |
| **Total** | **~$40.21** |

---

## The Scorecard

| Metric | Hermes | Claude Code |
|---|---|---|
| Wall clock time | ~10 hours | ~3 hours |
| Total tokens | ~17.7M | ~65.6M (cache-dominated) |
| Estimated cost | ~$75+ | ~$40.21 |
| Prompt caching | No | Yes |
| Gaps surfaced upfront | No — mid-session | Yes — 7 upfront |
| Post-build app config | Manual (operator) | Autonomous |
| End-to-end test | Not completed | Submitted + verified |
| Session discipline | Poor — 6.5 day unclosed session | Enforced via spec |
| Human interventions | Multiple environmental | Minimal — operator errors |

---

## Key Findings

### 1. Prompt Caching Is Not a Footnote

Hermes processes roughly the same underlying model (Sonnet 4.6) but routes through Claude.ai without prompt caching enabled. Code uses the API directly with caching active. The result: Code's 64M token cache reads cost $0.30/Mtok versus $3/Mtok for Hermes' re-sends. On a long agentic session with hundreds of turns, that's not a rounding error — it's the dominant cost variable.

If you're building on top of Claude, prompt caching isn't optional. It's structural.

### 2. Gap Detection Mode Matters More Than You'd Think

Code surfaced 7 blockers before writing a single line of configuration. Hermes surfaced gaps by running into them.

The practical difference: mid-session clarifying questions force a human to re-engage and break the autonomous run. Upfront gap detection allows the agent to work through an entire deployment without interruption. For autonomous infrastructure work, this distinction is the difference between supervised deployment and actually autonomous deployment.

### 3. The Spec Quality Is Half the Experiment

The tightened v2 spec gave Code a real head start. Better inputs, cleaner environment, pre-answered questions. The honest question is: how much of Code's performance win was the agent, and how much was the spec?

Answer: both. Code's upfront gap detection was the mechanism that surfaced exactly what needed to be in the v2 spec in the first place — Hermes told me what was missing right at the start, I patched the spec, and Code got clean inputs as a result. The better spec is partially a consequence of running Hermes first. But the spec gaps were always there; Hermes just surfaced them fast.

That said, Code's post-deployment autonomy — configuring applications, submitting a test request, validating the pipeline — went beyond anything the spec required. That's not spec quality. That's agent capability.

### 4. Host Resource Blindness Is a Real Problem

Code provisioned 16GB RAM per the spec recommendation. The spec said 16GB recommended. Code delivered it. That's correct behavior.

What Code had no visibility into: the Proxmox host's total RAM, how much was already allocated, and how many other VMs were running. Total over-commitment: 62GB allocated against 30GB physical. Both black-flag VMs suffered unexpected shutdowns under load due to OOM pressure.

This is a structural limitation of autonomous agents operating on infrastructure: **they can only see what you give them.** Host-level constraints — aggregate memory pressure, NUMA topology, shared storage throughput — are invisible unless explicitly included in the spec. The fix isn't to blame the agent; it's to build host-state awareness into the deployment checklist.

### 5. NFSv4 Hardlinks Don't Work the Way TRaSH Guides Assumes

Both agents hit this. The reference deployment pattern (TRaSH Guides) is built around hardlinks — when media is moved from downloads to the library, a hardlink is created so the torrent can continue seeding without holding a second copy.

NFSv4 doesn't support cross-mount hardlinks. The kernel can't create a hardlink across a network filesystem boundary. Radarr and Sonarr fall back to copying when hardlinks fail, which doubles storage usage until the torrent is cleaned up.

If your media stack runs on a NAS over NFS — which is a very common home lab configuration — you will hit this. The workaround is either bind-mounting the same NFS share inside the container so the "move" stays within one mount point, or accepting that your storage usage will spike temporarily during seeding.

### 6. Session Discipline Is an Infrastructure Concern

Hermes had a session that logged as "6.5 days" unclosed. No checkpoint. No handoff state. Just unbounded context accumulating in the background.

The v2 spec made `/wrap` a hard requirement — a `CURRENT_STATE.md` template, updated at session close, describing what was deployed, what's pending, and the state of every component. This isn't ceremony. It's the difference between a session that can be resumed cleanly and one that requires reconstructing context from scratch.

For multi-session infrastructure deployments, checkpoint discipline matters as much as the agent's technical capability.

### 7. Bazarr Needs One More Config Step

A smaller finding, but relevant for anyone building a proper home theater setup: Bazarr handles forced subtitle tracks — the translations that appear when characters speak non-English on screen. Gandalf speaking elvish, characters slipping into Klingon, the opening scene of *Inglourious Basterds*.

Forced subtitle support is not included in the default English subtitle configuration. You have to add "English (Forced)" as a separate language profile. It's not obvious from the UI that these are distinct entries, and without it, forced tracks won't be downloaded.

---

## Honest Caveats

The experiment isn't perfectly controlled, and I'd rather say that than pretend otherwise.

Code got a better spec. That was intentional — I didn't want to artificially penalize Code by giving it the same under-specified brief that surfaced Hermes' gaps. But it means the comparison has a variable I can't cleanly isolate.

Hermes' roadblocks — the Pi-hole rebuild, the cloud-init issues — were environmental, not agent failures. Code benefited from a cleaner environment because those problems had already been resolved.

Code's 16GB provisioning mistake was spec-following behavior, not a reasoning failure. The spec said 16GB recommended; Code delivered it. The host awareness gap is a checklist problem, not an agent problem.

The Matrix download was still technically in progress at the time I started writing this — the VM rebooted mid-download due to OOM pressure, but qBittorrent resumed after restart and completed it. End-to-end pipeline validated.

---

## Conclusion

Claude Code wins this round on every dimension that matters for autonomous infrastructure work: speed, cost, upfront gap detection, post-deployment configuration, and end-to-end validation. The prompt caching architecture alone makes a material difference on long agentic sessions.

Hermes isn't broken. It's a capable orchestration layer that picked up my existing tooling cleanly and made reasonable decisions throughout a difficult deployment. The session discipline problem is solvable with better spec requirements — I solved it in the v2 spec. The cost problem is harder: if Hermes doesn't have access to Anthropic's prompt caching, every long session is going to be expensive in a way that Code isn't.

The broader takeaway is less about which tool won and more about what the experiment revealed: **spec quality is half the deployment**. The clarifying questions Hermes asked mid-session became the upfront requirements that made Code's run clean. An autonomous agent can only work with what it's given. If you give it a complete picture — host state, network topology, credentials, expected outputs — the result is dramatically better. If you give it ambiguity, it will surface that ambiguity one way or another: either by asking mid-session, or by deploying something that mostly works but needs fixing.

The Matrix is in the Jellyfin library. The home theater is ready. The VPN is always on.

Project overview: this session is part of the broader [Home Lab](/blog/project-agent-lab) work.
