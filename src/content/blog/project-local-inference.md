---
title: "Project: Local Inference — Running LLMs On-Device with Ollama"
description: "An M5 Max MacBook Pro as a local AI inference node: Ollama, 70B and 32B models, unified memory architecture, and a comparison framework for benchmarking local vs. cloud-hosted inference."
pubDate: 2026-05-15
category: projects
draft: false
---

It's amazing how a simple laptop upgrade can take on a life of its own.

I discovered that my M3 Max MacBook Pro was worth a healthy amount and had initially considered moving to an M5 Pro. Then my partner in crime pointed out how this afforded me an opportunity to take my AI experiments a few levels further, and that led to an M5 Max. A few hours later with Claude Code and we're writing blog posts about the output. Anyone who hasn't recognized AI's effectiveness as a productivity multiplier hasn't played with it enough.

## The Why

The immediate motivation is professional: I work with companies deploying infrastructure purpose-built for large-scale AI inference. Being able to speak fluently about the architectural differences between local inference and AI-as-a-service isn't optional at this point — it's table stakes. This project is my hands-on answer to that gap.

The longer motivation: I already run a production RAG system called [OpenBrain](/blog/project-openbrain) — a hybrid retrieval pipeline built on Supabase/pgvector, exposed as a custom MCP connector in Claude.ai, as well as a custom GPT in ChatGPT. The architecture works well, but it has dependencies I don't control: Anthropic's API, a hosted Postgres instance, Vercel. This project mirrors that architecture locally and builds a structured comparison framework to understand what you're actually trading away (and gaining) when you move inference on-device.

## The Hardware

**Apple MacBook Pro M5 Max, 48GB unified memory.**

This matters significantly. The M-series architecture blurs the traditional CPU/GPU boundary — the GPU shares the same memory pool as the CPU, which means a large model doesn't need to fit in discrete VRAM. It just needs to fit in the unified pool. 48GB is enough to run a 70B model at Q4 quantization — with caveats I learned the hard way (more on that below).

## The Inference Layer: Ollama

[Ollama](https://ollama.com) is an open-source tool that wraps llama.cpp behind a clean REST API and a simple CLI. It handles model management, quantization selection, and serving. The API surface intentionally mirrors OpenAI's, which simplifies integration work considerably.

**Target models:**

| Model | Tag | Size | Rationale |
|---|---|---|---|
| Llama 3.3 70B | `llama3.3:70b-instruct-q4_K_M` | ~40 GB | Strong general reasoning; Meta's best open-weight model at time of writing |
| DeepSeek R1 32B | `deepseek-r1:32b` | ~18 GB | Chain-of-thought reasoning; interesting complement to Llama's style |

A note on the DeepSeek tag: the original plan specified `deepseek-r1:32b-q6_K` based on the `model:size-quant` naming convention. It doesn't exist — the Ollama registry didn't publish a Q6_K variant for that model. The default `deepseek-r1:32b` pulls Q4_K_M at ~18GB. Accepted the default and moved on.

**Memory arithmetic:** 40 + 18 = 58GB — exceeds the 48GB pool. Both models cannot be loaded simultaneously. For comparison runs, they run sequentially. For Phase 2 RAG work, one model is active at a time.

## The LaunchDaemon Detour

The original plan called for running Ollama as a macOS `launchd` LaunchDaemon — a system-level service that starts at boot independent of any user session. Standard practice for persistent background services.

It didn't work.

The daemon loaded cleanly (`launchctl load` returned no errors), but the service exited immediately with status code `19968`, which decodes to exit code `78` (`EX_CONFIG` in BSD sysexits). No log files were written, which meant the process was dying before it could open its stdout/stderr descriptors.

Diagnosis: **macOS restricts Metal GPU access to user sessions.** LaunchDaemons run in the system context before any user logs in, and Ollama needs Metal to enumerate the GPU on Apple Silicon. When it can't, it exits.

Running `ollama serve` manually in a user session confirms the difference immediately:

```
inference compute id=0 library=Metal name=Metal description="Apple M5 Max"
total="37.4 GiB" available="37.4 GiB"
```

The fix: **this doesn't need to be a persistent service.** Ollama is an on-demand tool. It gets started when local inference work is happening and stopped when it isn't.

```bash
./scripts/start_ollama.sh   # starts in background, polls until API is ready
./scripts/stop_ollama.sh    # kills cleanly
```

The LaunchDaemon plist is kept in `config/` for reference, annotated with why it was abandoned.

**Lesson:** "Survives reboot" is a valid requirement for production services. It's not a valid requirement for a development tool that runs on a laptop. Don't over-engineer the service model.

## compare_models.py

`scripts/compare_models.py` queries both models with the same prompt and renders side-by-side terminal output with per-model latency. It uses Ollama's `/api/generate` REST endpoint directly.

Key design choices:
- **No streaming** — `stream: false` in the request payload. Simplifies comparison output; we care about the full response, not time-to-first-token for this use case.
- **Configurable** — models and prompt are both CLI flags, so it's not hardcoded to the Phase 1 model set.
- **Graceful errors** — if Ollama isn't running or a model isn't loaded, the script reports the error in the output column rather than crashing.

```bash
python scripts/compare_models.py
python scripts/compare_models.py --prompt "Your prompt here"
python scripts/compare_models.py --models deepseek-r1:32b  # single model
```

## The Lockup Problem (And the Fix)

After Phase 1 was standing, a few sessions in I hit a pattern of hard system lockups requiring reboot. The culprit: loading `llama3.3:70b-instruct-q4_K_M` (~40GB) consumed ~83% of the 48GB unified memory pool, leaving ~8GB for the OS, active apps, and Metal GPU overhead. That headroom isn't enough. The machine locked.

Apple Silicon unified memory is shared between CPU, GPU (Metal), and OS — a model that "fits" on paper may still cause instability because Metal-mapped buffers can't be compressed or swapped. Ollama has no built-in memory guard. It will attempt to load whatever you ask.

Three environment variables in `start_ollama.sh` fixed this:

```bash
OLLAMA_MAX_LOADED_MODELS=1   # prevents both models loading simultaneously
OLLAMA_KEEP_ALIVE=5m         # auto-unloads idle models instead of holding RAM
OLLAMA_NUM_PARALLEL=1        # prevents concurrent requests compounding pressure
```

**70B dropped from default tooling.** `llama3.3:70b-instruct-q4_K_M` is retained on disk but removed from `compare_models.py` defaults and smoke checks. It's available via `--models` flag for intentional, monitored sessions. `deepseek-r1:32b` (~18GB) is the safe operational model for this machine.

**Safe rule for this hardware:** no model larger than ~30GB for routine use.

## Smoke Check

`scripts/smoke_check.py` validates that Ollama is actually doing inference, not just responding to health-check pings. It sends two known-answer probes to `deepseek-r1:32b`:
- Factual recall: capital of France
- Basic arithmetic: 15 + 27

Validates response content, minimum length, and response time. Exits 0 on pass, 1 on fail — designed for CI integration.

Previous validation only checked HTTP 200 on the `/api/tags` endpoint. That tells you Ollama is running, not that it can actually reason.

## What's Next — Phase 2

Phase 2 adds the RAG layer:
- A local vector database (Chroma or Qdrant — no external service dependencies)
- An ingest pipeline mirroring OpenBrain's structure (`source`, `source_type`, `subject`, `topic`)
- Hybrid retrieval (keyword + vector, RRF scoring) wired to Ollama inference
- Validation: RAG-augmented responses vs raw Ollama on the same query set

The interesting comparison at the end of Phase 2 won't just be local vs cloud — it'll be *local+RAG vs cloud+RAG*, which isolates the inference layer as the variable. That's the comparison that's actually useful professionally.

Session notes: [Local Inference — Lockup Diagnosis & Fix](/blog/session-local-inference)
