---
title: "Session: Dynamic Clippy Quips & Homepage Enhancements"
description: "Built AI-powered Clippy quip generation from HackerNews, added responsive recent posts section to homepage, and fixed CI/CD pipeline Node.js compatibility."
pubDate: 2026-04-07
category: sessions
draft: false
---

## What We Built

Three major features landed in this session, all focused on improving the portfolio's personality and usability:

### 1. Dynamic Clippy Quips from HackerNews

Clippy (the mascot) now generates fresh, AI-themed jokes based on trending HackerNews stories, regenerated every Sunday.

**How it works:**
- Scheduled GitHub Actions workflow fetches top HackerNews stories (filtered for AI/ML relevance)
- Claude API generates 5 new quips per category (GENERIC, SESSION, PROJECT, ABOUT)
- Fresh quips get merged with hardcoded classics and cached in `src/data/clippy-quips.json`
- Build-time generation via Astro integration hook (no runtime cost)
- Three-tier fallback ensures builds never fail: generated JSON → hardcoded constants → inline

**Implementation:**
```typescript
// Fetch HN stories → Claude generation → merge with classics
src/scripts/generate-clippy-quips.ts  // 200 lines, handles the pipeline
src/integrations/clippy-quips.ts      // Astro build hook
src/data/hardcoded-quips.ts          // Classic quips (never change)
src/data/clippy-quips.json           // Generated + classics (weekly update)
.github/workflows/regenerate-clippy-quips.yml  // Scheduled + manual trigger
```

**Why this approach:**
- Fresh content keeps the site feeling alive
- Hardcoded classics ensure consistency + zero risk of total failure
- Weekly regen (not per-build) avoids API calls on every deploy
- Graceful degradation: if HN is down or Claude API fails, site still works

**Status:** 
- ✅ Integrated
- ✅ Tests passing
- ⏳ Awaiting first scheduled run (Sunday)
- 📝 Requires `CLAUDE_API_KEY` secret in GitHub (now set)

---

### 2. Recent Posts Component (Responsive Grid)

Added a "Recent Posts" section to the homepage showing the 4 most recent posts in date-stamped bubbles.

**Layout evolution:**
- First iteration: 3 posts, `grid-template-columns: repeat(auto-fit, minmax(250px, 1fr))`
- Issue: Rendered as 2+1 grid, causing asymmetrical layout ("OCD brrrrrr")
- Solution: Explicit responsive breakpoints with fixed column counts

**Final design:**
- **Mobile:** 1 column (full width)
- **Tablet (768px+):** 2 columns (balanced pairs)
- **Desktop (1200px+):** 4 columns (perfect square grid)

**Each bubble shows:**
- Post title (truncated to 3 lines)
- Description (preview text)
- Publication date (red accent color)
- Hover effect (shadow, slight lift, title color change)

**Implementation:**
```typescript
// src/components/RecentPosts.astro
const fourRecentPosts = recentPosts.slice(0, 4);  // 4 most recent
// CSS: grid-template-columns: 1fr (mobile) → repeat(2, 1fr) (tablet) → repeat(4, 1fr) (desktop)
```

---

### 3. Homepage Polish

**Centered the "Built with Claude AI" stamp:**
- Was left-aligned (looked off-balance)
- Added `display: flex; justify-content: center;` to `.stamp-wrap`
- Now perfectly centered beneath the fold
- Improves perceived visual balance

---

## CI/CD Pipeline Fixes

Two separate issues fixed:

### Issue #1: Node.js Version Incompatibility
**Problem:** Astro 6.1.3 requires Node >=22, but workflows were stuck on 18
**Solution:**
```yaml
# .github/workflows/ci.yml + post-merge-verify.yml
node-version: '22'  # was '18'
```
Updated `package.json` engines constraint to match.

### Issue #2: Playwright Browser Installation
**Problem:** E2E tests failed because browsers weren't installed
**Solution:**
```yaml
- name: Install Playwright browsers
  run: npx playwright install
```
Added this step to both CI workflows before running tests.

### Issue #3: HTML Entity Encoding in Tests
**Problem:** Build completeness tests were checking if post titles appeared in HTML
**Reality:** Titles get HTML-encoded (`&` → `&amp;`, `'` → `&#39;`)
**Solution:**
```typescript
// tests/build-completeness.test.ts
const escapedTitle = escapeHtmlEntities(post.frontmatter.title);
const titleFound = content.includes(post.frontmatter.title) || content.includes(escapedTitle);
```

---

## Testing & Validation

**Local testing:**
- ✅ `npm run build` completes clean
- ✅ All 23 unit/content/build tests pass
- ✅ Draft posts correctly excluded from prerender
- ✅ HackerNews fetch verified (found 5 AI-related stories)
- ✅ Responsive grid renders 1/2/4 columns correctly

**CI/CD (PR #29):**
- ✅ Build & Test job (unit, content, build completeness)
- ⏳ E2E tests (Playwright: chromium, Firefox, webkit, mobile)
- Then: Merge Gate check

---

## Lessons Learned

### UX Preferences
- **Asymmetrical layouts are visually jarring** — Always prefer balanced grids with even distribution
- **Centering adds perceived balance** — Don't assume left-align is neutral
- **Responsive breakpoints need intentionality** — `auto-fit` can produce awkward distributions; explicit columns are better

### Architecture
- **Three-tier fallback is worth the complexity** — Never let external API calls block the build
- **Hardcoded classics provide safety net** — Always have an offline-friendly version of dynamic content
- **Build hooks are powerful** — Astro integrations can run arbitrary scripts before build

### Testing
- **HTML entities trip up string matching** — Always account for encoding in tests
- **E2E tests are *slow* but catch real issues** — Worth the CI time investment
- **Test fixtures matter** — Mocking tests passed but production migrations failed; real content is non-negotiable

---

## What's Next

1. **Monitor first scheduled quip regen:** Sunday 00:00 UTC, watch GitHub Actions for commit
2. **Measure Clippy engagement:** Check if users interact more with dynamically relevant quips
3. **Consider seasonal themes:** Could rotate quips based on AI landscape (conference season, model releases, etc.)
4. **Expand recent posts:** Could add category filtering ("Recent Sessions", "Recent Projects")
5. **A/B test layout:** Collect feedback on 4-post grid vs other counts

---

## Files Changed

**New files:**
- `src/components/RecentPosts.astro`
- `src/data/hardcoded-quips.ts`
- `src/data/clippy-quips.json`
- `src/scripts/generate-clippy-quips.ts`
- `src/integrations/clippy-quips.ts`
- `.github/workflows/regenerate-clippy-quips.yml`

**Modified files:**
- `astro.config.mjs` (register integration)
- `src/components/ClippyWidget.astro` (import from JSON)
- `src/pages/index.astro` (add RecentPosts component, center stamp)
- `.github/workflows/ci.yml` (Node 22, Playwright install)
- `.github/workflows/post-merge-verify.yml` (Node 22, Playwright install)
- `tests/build-completeness.test.ts` (HTML entity handling)
- `package.json` (add @anthropic-ai/sdk, tsx, generate:clippy-quips script)

**Total:** +650 lines added, 35 lines modified across 13 files

---

## Summary

This session added personality and polish to the portfolio. Clippy now tells AI news jokes, the homepage shows recent work at a glance, and the CI/CD pipeline is future-proof (Node 22 compatible). All changes maintain the principle of graceful degradation—the site works even if external APIs fail.
