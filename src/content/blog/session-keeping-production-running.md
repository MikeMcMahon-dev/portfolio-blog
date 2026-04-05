---
title: "Session: Keeping Production Running — Build Health & Smoke Tests"
description: "Fixed critical blog rendering regression, established global Claude Code infrastructure, and added comprehensive smoke test suite to catch regressions before they reach users."
pubDate: 2026-04-05
category: sessions
draft: false
---

## The Incident

After implementing the email subscription and RSS feature, I discovered that the portfolio-blog had a critical regression: projects and sessions pages weren't rendering. Pages like `/blog/project-openbrain` existed in git but returned 404 in production. The sidebar showed the links, but clicking them failed.

## Root Cause

The blog uses Astro with SSR (server mode) + static prerender. The dynamic route `/src/pages/blog/[...slug].astro` was missing a critical export:

```typescript
export const prerender = true;
```

Without it, Astro's router was ignoring the dynamic page in server mode, never generating the static HTML files. Classic "I changed the config but forgot to tell Astro to generate these routes" mistake.

## Fixes Applied

### 1. Restore Blog Rendering (#23)
- Added `export const prerender = true;` to the blog dynamic route
- Updated `resend` from ^3.2.0 to ^6.0.0 (eliminated deprecated `glob@10.5.0` transitive dependency)
- Updated Node constraint from >=22.12.0 to >=18 (allows auto-upgrade, reduces Vercel warnings)
- Result: All 14 blog posts now prerender as static HTML ✓

### 2. Add Project State Tracking (#24)
- Created `CURRENT_STATE.md` to track build status, known issues, environment setup, next priorities
- Helps future sessions understand project health at a glance

### 3. Comprehensive Smoke Test Suite (#25)
Implemented 4-layer test coverage to catch regressions like this one before they reach users:

**Build Health Tests** (7 tests, vitest)
- Prerender count: 14+ blog posts
- Critical pages exist: blog index, subscribe, unsubscribe
- Static assets in place: favicons, fonts
- No deprecated packages

**Content Validation Tests** (10 tests, vitest)
- All posts have required frontmatter: title, description, pubDate, category
- Valid categories only: 'about', 'sessions', 'projects'
- No duplicate slugs
- Posts have reasonable length and valid markdown
- No future-dated posts

**E2E Tests** (25 tests, Playwright × 5 browsers)
- Navigation: header links work, home/blog/subscribe pages reachable
- Blog reading: post listings render, individual posts load without 404
- Forms: subscribe/unsubscribe pages render and accept input
- Mobile responsive: touch targets accessible, no horizontal overflow

**Run Tests Locally**
```bash
npm run test          # Unit/content tests (< 2s)
npm run test:build    # Build + prerender (< 3s)
npm run test:e2e      # E2E across 5 browsers (< 30s)
npm run test:all      # Everything (< 40s)
```

### 4. Fix Project Chronology (#26)
- Updated `project-ai-engineering-plan.md` pubDate from 2026-04-02 to 2026-03-15
- Reflects when the actual work started (docs published later)
- Now sorts to top of Projects list where it belongs

## Global Claude Code Infrastructure

This session also established a working model for managing Claude Code sessions across all projects. The system now has:

### Settings & Hooks (in ~/.claude/)
- **CLAUDE.md** — Global working instructions (inheritable by all projects)
- **settings.json** — openbrain MCP registered globally, session start/end hooks
- **startup-ritual.py** — Auto-loads MEMORY.md + CURRENT_STATE.md on session start

### Memory Model
- **MEMORY.md** (project root) — Lean index: behavioral rules + openbrain query pointers
- **Memory files** (~/.claude/projects/<project>/memory/) — Only feedback rules and project governance (non-stale info)
- **openbrain MCP** — Rich, queryable context: architecture, lessons learned, session recaps

### Applied To
- portfolio-blog ✓
- home-lab root ✓
- open-brain, multi-agent-lab, agent-lab, homelab-talos-cluster ✓

## Git Workflow Reinforcement

The session also cemented the non-negotiable git workflow:
1. Never commit to main — always feature branch
2. Show diff and ask permission before committing
3. Use `/commit` skill for proper workflow
4. All changes: feature branch → PR → merge

All commits this session followed this discipline and resulted in clean, atomic PRs with clear commit messages.

## What This Prevents

The smoke tests now catch:
- ✅ Missing static prerender (like the regression discovered after the email subscription feature)
- ✅ Deleted or moved blog posts
- ✅ Broken navigation links
- ✅ Form regressions (subscribe/unsubscribe)
- ✅ Mobile rendering breaks
- ✅ Build warnings and deprecated packages
- ✅ Frontmatter validation failures

## Next Session Startup

When you open the blog again, the session ritual will:
1. Load MEMORY.md (behavioral rules)
2. Load CURRENT_STATE.md (status snapshot)
3. Query openbrain for architecture context and last session recap
4. Display working instructions from global CLAUDE.md

All PRs have been merged. Main is at commit `3d80c4a`. Smoke tests pass. Production is running clean.

---

**All tests passing** ✓
```
Test Files  2 passed
Tests       17 passed

Build Tests
Tests       7 passed

Blog posts prerendered: 14/14 ✓
```
