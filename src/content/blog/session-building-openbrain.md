---
title: "Building OpenBrain: A Personal RAG Knowledge System"
description: "Standing up a Retrieval-Augmented Generation system backed by Pinecone, hosted on Vercel, and wired into Claude Code sessions."
pubDate: 2026-03-15
category: sessions
draft: false
---

*Full write-up coming soon.*

OpenBrain is a personal knowledge system built on RAG (Retrieval-Augmented Generation). The core idea: instead of re-explaining context at the start of every AI session, ingest it once and query it on demand.

Topics covered in this session:
- Pinecone vector store setup and namespace strategy
- Vercel deployment and MCP server integration
- Claude Code session hooks for automatic context injection
- Iterating on the ingest format to improve retrieval quality
