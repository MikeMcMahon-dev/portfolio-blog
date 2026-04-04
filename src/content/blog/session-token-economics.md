---
title: "Session: Token Economics and Model Cost Calculation"
description: "Building a Python CLI that projects cost across six models by task type and complexity, using real cost data from the agent eval harness and OCR eval."
pubDate: 2026-04-10
category: sessions
draft: true
---

*Full write-up coming soon.*

The agent eval harness and OCR eval produced real cost data across five models on two task types — infrastructure diagnosis and vision OCR. That data is the foundation for a proper cost calculator.

Topics to be covered:
- Task type classification: infrastructure diagnosis vs OCR vs retrieval vs general reasoning
- Per-model cost curves based on measured data (not vendor estimates)
- Blended cost calculator for multi-model workflows (e.g., Haiku for triage + Sonnet for escalation)
- CLI design: task type + complexity → projected cost across models with routing recommendation
