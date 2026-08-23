---
title: "Start Here: The Short Version"
description: "A summary of the AI engineering work on this site, with the measured findings rather than the narrative. Written to be read in two minutes and forwarded to someone who has less time than that."
pubDate: 2026-08-23
category: about
draft: false
---

I run infrastructure for a living and I have spent the last several months building AI systems that operate real infrastructure, then instrumenting them to find out how they fail. Not demos. A homelab that runs Kubernetes, DNS, a media stack, a knowledge vault used daily by my family, and a multi-agent system that provisions against live Proxmox.

The interesting output is not that any of it works. Everyone has a demo that works. The output is a body of measurements about where these systems break, and the controls that catch it.

## What I measured

Model cost is not correlated with model quality on diagnosis tasks. Across a six-scenario failure-diagnosis suite, Claude Opus cost 57 times more than Sonnet, matched the cheapest model's retry count, and reproduced the same wrong hypothesis. Haiku diagnoses a failure for $0.0017 and remains the production choice. Picking a model is a cost-control decision with a measurable answer, and most teams are guessing at it.

Agent failure modes are enumerable and instrumentable. Six of them, each with a metric signal that detects it and a runbook that resolves it, exported to Prometheus and visible on a Grafana dashboard. The failure taxonomy is the piece that transfers to other organisations.

The most dangerous failures are silent. A gate that returned success while writing nothing. A guard that, unable to evaluate its own rule, allowed the write. A validation check that had been green for months while being structurally incapable of failing. None of these throw errors, none page anyone, and conventional tests pass straight through them.

Deployed is not the same as exercised. A human-approval airlock for irreversible deletions shipped fully wired and reviewed, and its delete path had never executed once. The first real run failed three different ways. "It has a caller" and "it has run" are different claims, and only the second is evidence.

## Where to read more

The synthesis piece is [Six Ways AI Agents Fail in Production Infrastructure](/blog/ai-agent-failure-modes) - the failure taxonomy, the detection signals, and the controls, in one place.

For the underlying work: the [eval harness](/blog/project-agent-eval-harness) has the model cost comparison and judge-disagreement data. The [failure detection dashboard](/blog/project-failure-detection-dashboard) covers the instrumentation. The [multi-agent system](/blog/project-multi-agent-lab) is the thing being measured. [OpenBrain](/blog/project-openbrain) is a retrieval system with a temporal model, currently the subject of most of my hardening work.

Session posts are working notes, written as the work happened, including the parts that went badly. [One of them](/blog/session-ai-compliance-failure) is an AI agent's account of violating an explicit directive three times in a single session, which I made it write up afterwards.

## What I am interested in

Infrastructure and observability teams adopting AI, where somebody needs to be honest about the failure modes rather than enthusiastic about the demos. Consulting or full-time. The useful thing I bring is not that I can get an agent to work - it is that I can tell you how yours is failing and what to instrument to see it.

Reachable through the contact link. I answer specific questions faster than general ones.
