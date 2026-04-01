---
title: "Project: OpenBrain"
description: "A personal RAG knowledge system that persists context across AI sessions — Pinecone backend, Vercel-hosted, MCP-integrated."
pubDate: 2026-03-15
category: projects
draft: false
---

OpenBrain is a personal Retrieval-Augmented Generation (RAG) system built to solve a real problem: AI sessions start cold. Every conversation begins without knowledge of previous work, preferences, or project context.

**Architecture:**
- Pinecone vector store for semantic search
- Vercel serverless deployment
- MCP (Model Context Protocol) server for Claude Code integration
- Session hooks that auto-query context at session start

**Current capabilities:**
- Ingest text, notes, and session summaries
- Query by semantic similarity at session start
- Persistent memory across Claude Code sessions via MEMORY.md + openbrain_query
- Flashcard and quiz generation from ingested content (Annie's tutor application)

**Status:** Production use. Running daily for homelab sessions.

Session notes: [Building OpenBrain](/blog/session-building-openbrain)
