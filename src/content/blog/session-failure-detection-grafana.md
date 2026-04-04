---
title: "Session: Failure Detection Dashboard with Grafana"
description: "Building a Grafana dashboard for real-time visibility into multi-agent infrastructure failure patterns, wired to the Prometheus instrumentation from the eval harness."
pubDate: 2026-04-10
category: sessions
draft: true
---

*Full write-up coming soon.*

The agent eval harness has Prometheus instrumentation and a 6-scenario failure suite. The missing piece: a Grafana dashboard that makes failure patterns visible in real time — one panel per failure mode, wired to the counters already being emitted.

Topics to be covered:
- Grafana panel design for each failure mode (context degradation, specification drift, cascading failure, silent failure, sycophantic confirmation, tool selection errors)
- Prometheus datasource configuration and PromQL queries
- Alerting thresholds based on the eval harness baseline data
- Adversarial scenarios for the two uncovered failure modes
