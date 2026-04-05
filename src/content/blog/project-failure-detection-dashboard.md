---
title: "Project: Failure Detection Dashboard"
description: "Infrastructure observability for AI agent failures — 6 failure modes instrumented via Prometheus/Grafana, cost analysis of OCR model selection, runbooks for diagnosis."
pubDate: 2026-04-04
category: projects
draft: false
---

# Failure Detection Dashboard — Observability for AI Agent Failures

When you build autonomous AI agents that interact with infrastructure, things go wrong in predictable patterns. My Failure Detection Dashboard makes those patterns visible — and teaches you which failures are cheap to detect and which ones are expensive lessons.

## The Problem

The multi-agent infrastructure deployment system I built in Week 2 runs Terraform jobs through an LLM diagnosis loop: if terraform plan/apply fails, the LLM proposes a fix, we retry, and repeat up to a cap. This works well, but visibility is poor. You know *whether* it failed, but not *how* or *why* — and more importantly, which failure modes are burning budget.

Early runs showed 228 eval scenarios across 8 different failure types. With 125 failures and only $3.94 in cost, something didn't add up. Digging into the metrics revealed the culprit: **one scenario (OCR geometry degraded) consumed 2/3 of the entire cost**.

That observation led to this dashboard and the infrastructure-wide monitoring setup it validates.

## Architecture: 6 Failure Modes, Fully Instrumented

I designed the dashboard around 6 distinct failure modes from real agent diagnosis patterns:

| Failure Mode | Symptom | Cost Signal |
|---|---|---|
| **Context Degradation** | LLM hypothesis drifts further from root cause with each retry | High input tokens on later retries |
| **Specification Drift** | Same error, different models propose different fixes (Haiku vs Sonnet) | Cost variance across model lines |
| **Cascading Failure** | 3+ independent config errors; LLM must enumerate all of them sequentially | High retry count (2-3 per scenario) |
| **Silent Failure** | Happy path: 0 LLM calls, $0.00 cost | Target metric: should be 100% of happy runs |
| **Sycophantic Confirmation** | LLM confidently proposes the same fix repeatedly despite apply-time failures | Identical hypothesis repeatedly in logs |
| **Tool Selection Errors** | LLM proposes unavailable providers/tools not in registry | LLM proposals vs ToolRegistry enforcement |

Each mode is instrumented via Prometheus counters pushed from the eval harness:

```
eval_scenario_runs_total{scenario, model, status}        — outcomes
eval_scenario_tokens_total{scenario, model, token_type}  — input/output tokens
eval_scenario_cost_dollars_total{scenario, model}        — cumulative cost
eval_scenario_retries_total{scenario, model}             — retry attempts
```

The Pushgateway pattern (from ADR-003) fits perfectly here: batch jobs push metrics after completion, Prometheus scrapes the gateway every 15s, and Grafana refreshes panels every 30s. No pull-based scraping overhead.

## The Dashboard: 10 Panels, 228 Data Points

### Summary Stats (Top Row)
- **Success Rate Gauge**: Currently 45.2% (103 SUCCESS, 125 FAILED) — Room for improvement
- **Total Cost**: $3.94 across all 228 runs — Surprisingly low, but let's dig in
- **Total Runs**: 228 eval scenarios executed — Good coverage of all failure types

### Failure Breakdown (Panel 2: Pie Chart)
Shows SUCCESS vs FAILED distribution by status. **Key insight**: Pie chart by status is less useful than breakdown by scenario — you need to know *which scenarios fail most*, not just aggregate success rate.

### Failure Modes by Scenario (Panel 3: Stacked Bar)
`sum by(scenario, status)(eval_scenario_runs_total)`

- **lxc-happy-path, vm-happy-path**: Majority SUCCESS (good — these are baselines)
- **fail-simple, fail-vm-simple**: Mostly FAILED (expected — single error scenarios)
- **fail-complex, fail-vm-complex**: All FAILED (expected — cascading failures hit retry cap)
- **ocr-handwritten-biology, ocr-geometry-degraded**: Mixed (vision OCR quality varies)

### LLM Calls Per Scenario (Panel 4: Bar Chart)
`max by(scenario)(eval_scenario_retries_total)`

- **fail-simple**: ~1 retry (single error, clear signal)
- **fail-complex**: ~2-3 retries (enumeration across 3 axes)
- **fail-vm-complex**: ~2-3 retries (template + storage, both invalid)
- **OCR scenarios**: ~1 retry (mostly pass/fail, limited recovery)

### Token Efficiency (Panel 5: Table)
Raw data: input_tokens, output_tokens, cost_usd per scenario+model.

**Surprising finding**: OCR geometry has low token count (~500-1000 total) but high cost. Why?

→ Sonnet model at $5/1M input, $15/1M output. Haiku costs ~5x less. Geometry used Sonnet (handwritten-like degradation), running 40 pages through vision OCR.

### Cost Trend Over Time (Panel 6: Line Chart)
`sum by(scenario)(eval_scenario_cost_dollars_total)`

**The smoking gun**: One line dominates the chart.

## The Case Study: Why OCR Geometry Degraded Is So Expensive

Let me trace the cost:

1. **Ground truth**: 40-page geometry practice test, poor scan quality
2. **Strategy**: Evaluate OCR recovery rate — how much text can we extract despite degradation?
3. **Model choice**: Tested Haiku, Sonnet, Opus, GPT-4o
4. **Result**: Only Sonnet achieved 0.846 recovery rate (threshold 0.80)
5. **Cost**: Sonnet @ $5/1M input, $15/1M output. 40 pages × ~5000 tokens/page = 200K input tokens
6. **The bill**: (200,000 / 1,000,000) × $5 = **$1.00 per run**

Run it twice (comparative eval), and you're at **$2.00** — nearly half the total eval budget for one 40-page PDF.

Compare to fail-simple: Single terraform error, Haiku ~800 tokens input, ~100 output = **$0.0005 per run**. 
4,000x cheaper.

### Lessons From the Numbers

**1. Vision OCR is expensive at scale**
- Handwritten-1page (biology notes): Sonnet $0.015/run
- Degraded-40pages (geometry): Sonnet $1.00/run
- **Solution**: Haiku for printed/clean, Sonnet only for handwritten, direct extraction for text-layer PDFs

**2. Model size drives hypothesis complexity**
- Haiku: Narrow focus, ~300-500 output tokens, clear recommendations
- Sonnet: Broader hypothesis space, ~500-1000 output tokens, multi-axis reasoning
- Cost multiplier: 5-10x depending on input
- **Solution**: Route by error class. Simple errors → Haiku. Cascading → Sonnet.

**3. Eval harness amplifies real-world costs**
- We ran multiple scenarios with multiple models (cross-product testing)
- If you ship a feature that uses Sonnet everywhere, multiply by production volume
- The geometry scenario is a warning: **don't OCR 40-page PDFs page-by-page through Claude**

**4. Happy path is cheap (and you need it)**
- 105 successful runs, 0 LLM calls, $0.00 cost
- That's the baseline. Any degradation from there is visible.
- Alert on regression: if happy-path success rate drops below 99%, something is wrong

## How to Read the Dashboard

**When Something Costs Too Much:**

1. Check the **Cost Trend** panel — which scenario line is growing?
2. Jump to **Token Efficiency** table — input/output tokens per model
3. Check **LLM Calls** — is retry count high (2-3)? If so, maybe context degradation
4. Look at **Runbooks** for diagnosis steps

**When Something Fails Unexpectedly:**

- Navigate to **Failure Mode Breakdown** — which scenario failed?
- Read corresponding runbook: e.g., cascading-failure if fail-complex has high retry count
- Check Prometheus: `http://docker01.mcmahon.home:9090/graph`
- Query: `eval_scenario_runs_total{scenario="fail-complex", status="FAILED"}`

## Infrastructure Setup

**Monitoring stack** (Prometheus + Pushgateway + Grafana) lives in the home-lab `monitoring/` directory and is version controlled along with dashboard definitions and runbooks.

To deploy:
```bash
cd monitoring/docker
docker-compose up -d
```

Verify:
- Prometheus: `http://docker01.mcmahon.home:9090/targets`
- Grafana: `http://docker01.mcmahon.home:3000/d/failure-detection-main`
- Pushgateway: `http://192.168.100.54:9091/metrics`

## What's Next

**Week 3B**: Token Economics Calculator
- Real cost data is in hand (228 eval runs × 6 models)
- Next: CLI tool to predict costs for new scenarios
- Input: task type + complexity, Output: projected cost across Haiku/Sonnet/GPT-4o/etc

**Beyond Week 3**:
- Automated alerts: "OCR scenario exceeds $X per run"
- A/B testing harness: Compare model A vs B on same task
- Cost optimization: Auto-route to cheapest viable model per failure mode
- Runbook automation: Alert links to relevant runbook + remediation steps

## The Key Insight

Failure detection isn't about preventing failures — it's about making them visible and cheap. When your LLM-powered agent hits an error, it should cost $0.0005 to diagnose (like fail-simple), not $1.00 (like OCR geometry). The dashboard makes that difference unmissable. And once it's visible, you can fix it: use cheaper models, add pre-flight validation, route intelligently.

The 2/3 cost for one scenario wasn't a surprise because of luck — it was inevitable because vision OCR is expensive. The surprise was that the dashboard made it obvious in 15 seconds of looking at one chart.

That's the value of instrumentation.
