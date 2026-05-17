---
title: "Session: Local Inference — Diagnosing the Lockups"
description: "Hard system lockups traced to memory exhaustion from loading a 40GB model on a 48GB machine. Three env vars fixed it. Also: real inference validation via smoke check, and why the 70B is off the default toolchain."
pubDate: 2026-05-16
category: sessions
draft: false
---

## The Problem

After Phase 1 of the local inference project was standing — Ollama running, both models pulled, `compare_models.py` working — I started hitting hard system lockups. Keyboard unresponsive, no crash log, full reboot required. Happened twice.

The pattern: lockups always occurred during or shortly after sessions where I was actively using the `llama3.3:70b-instruct-q4_K_M` model.

## Root Cause: Memory Exhaustion

`llama3.3:70b-instruct-q4_K_M` is a 40GB model. Loading it on a 48GB machine consumes ~83% of the available unified memory pool, leaving roughly 8GB for the OS, active applications, and Metal GPU overhead.

That 8GB isn't enough. The machine locks.

**The subtlety with Apple Silicon:** unified memory is shared between CPU, GPU (Metal), and OS. It's not like discrete GPU VRAM where the model sits in one pool and system memory is separate. A model that fits on paper may still cause instability because Metal-mapped buffers can't be compressed or swapped out under pressure. There's no overflow path — when memory is exhausted, the system doesn't gracefully degrade. It locks.

Ollama has no built-in guard against this. It will attempt to load whatever you ask, regardless of available RAM.

## The Fix: Three Environment Variables

Three env vars added to `start_ollama.sh`:

```bash
export OLLAMA_MAX_LOADED_MODELS=1
export OLLAMA_KEEP_ALIVE=5m
export OLLAMA_NUM_PARALLEL=1
```

**`OLLAMA_MAX_LOADED_MODELS=1`** — prevents both models from loading simultaneously. Without this, a session that uses both `llama3.3:70b` and `deepseek-r1:32b` could attempt to hold 40 + 18 = 58GB in memory at once, well beyond the 48GB pool.

**`OLLAMA_KEEP_ALIVE=5m`** — Ollama's default behavior is to keep a loaded model in memory indefinitely after use. This means if you run the 70B, walk away, and later start a comparison run that also loads the 32B, both are in memory. Five-minute keepalive ensures idle models are evicted before they compound pressure.

**`OLLAMA_NUM_PARALLEL=1`** — prevents concurrent requests from being processed simultaneously. Under load, parallel inference can spike memory usage above the model's baseline footprint.

## 70B Off the Default Toolchain

`llama3.3:70b-instruct-q4_K_M` is retained on disk but removed from `compare_models.py` defaults and the smoke check.

It's still available:
```bash
python scripts/compare_models.py --models llama3.3:70b-instruct-q4_K_M
```

But only for intentional, monitored sessions — not routine use.

`deepseek-r1:32b` (~18GB) is the safe operational model for this machine. **Safe rule: no model larger than ~30GB for routine use on 48GB hardware.** The 70B needs another 16+ GB of headroom the machine doesn't reliably have once the OS, apps, and Metal overhead are accounted for.

## Real Inference Validation

The existing health check only pinged `/api/tags` — Ollama's model list endpoint. That tells you the server is running. It tells you nothing about whether inference actually works.

`scripts/smoke_check.py` sends two known-answer probes:

```python
probes = [
    {"prompt": "What is the capital of France?", "expected": "paris"},
    {"prompt": "What is 15 + 27?", "expected": "42"},
]
```

Validates:
- Response contains the expected answer (case-insensitive)
- Response is at least 5 characters (not an empty or truncated response)
- Response time is under 120 seconds

Exit 0 on pass, exit 1 on failure — designed for CI use. Both probes confirmed passing post-fix on the live Ollama instance with the env vars active.

## What the Lockups Were Actually Telling Me

The lockups weren't a bug — they were the hardware enforcing a constraint I'd ignored. The M5 Max is genuinely capable of running a 70B model, but "capable" and "stable for routine use" are different things. At 40GB of model weight, you're running at ~83% memory utilization before the first token is generated. There's no slack for anything else.

The right mental model for unified memory: it's a shared pool with no overflow. Every GB of model weight is a GB unavailable to the OS and Metal. The lockup isn't a crash — it's the hardware running out of headroom.

## Process Notes

This session also formalized the git workflow for the project:
- Branch protection on `main` — direct push blocked at the GitHub level
- All changes go through feature branch → PR → merge
- `/commit` skill for Claude Code sessions enforces this consistently

## What's Next

Phase 2: the RAG layer.

- Local vector database (Chroma or Qdrant — evaluating which fits the OpenBrain schema better)
- Ingest pipeline mirroring OpenBrain's `source`, `source_type`, `subject`, `topic` structure
- Hybrid retrieval: keyword + vector search with RRF scoring, wired to Ollama inference
- Validation: RAG-augmented vs raw Ollama on the same query set, measuring response quality

The end goal of Phase 2 is a like-for-like comparison: local+RAG vs cloud+RAG. That comparison isolates the inference layer as the variable — which is the professionally relevant question.

Project overview: [Local Inference Project](/blog/project-local-inference)
