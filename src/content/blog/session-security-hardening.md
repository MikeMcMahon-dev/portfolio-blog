---
title: "Session: Security Hardening the Homelab"
description: "Reviewing and remediating security findings across the homelab — secrets exposure, network segmentation, and Claude session controls."
pubDate: 2026-03-30
category: sessions
draft: false
---

*Full write-up coming soon.*

A structured security review pass across the homelab projects. Started with automated scanning, triaged findings by exploitability, and worked through remediations.

Focus areas:
- Secrets management: moving credentials out of tracked files and into proper secret stores
- Claude session hook security: hardening the scripts that run at session start/stop
- Network segmentation review for the Talos cluster
- Documenting findings in a tracked security-concerns directory
