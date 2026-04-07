# Portfolio Blog — Current State

**Last updated:** 2026-04-07 (dynamic Clippy quips, recent posts section, CI/CD pipeline fixes)

## Build & deployment status
- ✅ **Functional** — All pages rendering, build clean
- **Last build:** 2026-04-07 (with recent posts & Clippy quips)
- **Prerendered:** 15 blog posts (6 projects, 8 sessions, 1 about, 1 credits, + new session post)
- **Warnings:** None (Vercel Node version note is informational only)
- **Deprecated packages:** None
- **Site:** https://mikemcmahon.dev (auto-deploys from main branch via Vercel)
- **CI/CD:** PR #29 with all enhancements, E2E tests running

## Recent enhancements (2026-04-07)
- ✅ **Dynamic Clippy Quips:** HackerNews + Claude API generation, weekly refresh
  - Regenerates every Sunday via GitHub Actions
  - Requires `CLAUDE_API_KEY` secret (now set)
- ✅ **Recent Posts Component:** 4 most recent posts on homepage
  - Responsive grid: 1 col (mobile), 2 cols (tablet), 4 cols (desktop)
  - Date-stamped bubbles with titles, descriptions, links
- ✅ **Homepage Polish:** Centered "Built with Claude AI" stamp
- ✅ **CI/CD Fixes:**
  - Updated Node.js 18 → 22 (Astro 6.1.3 requirement)
  - Added Playwright browser installation to CI workflows
  - Fixed build tests for HTML entity encoding

## Known issues
None currently.

## In progress (PR #29)
- Dynamic Clippy quips implementation + recent posts section
- All unit/content/build tests passing
- E2E tests running (Playwright multi-browser suite)
- Awaiting CI completion before merge

## Infrastructure & dependencies

### APIs & backends
| Service | Purpose | Env var |
|---|---|---|
| Supabase | Newsletter subscriber DB | `SUPABASE_URL`, `SUPABASE_KEY` (.env.local) |
| Resend | Email delivery (^6.0.0+) | `RESEND_API_KEY` (.env.local) |
| Claude API | Clippy quip generation | `CLAUDE_API_KEY` (GitHub Secrets) |
| HackerNews | Trending stories for quips | None (free public API) |
| Vercel | Hosting, serverless functions | Auto-configured |

### Build process
- **Type:** Astro SSR (server mode) + static prerender for blog routes
- **Command:** `npm run build`
- **Output:** Prerendered HTML in `dist/client/blog/`, serverless functions in `.vercel/output`
- **Dynamic route:** `/src/pages/blog/[...slug].astro` has `export const prerender = true;`

### Blog structure
- **Content:** `src/content/blog/` (Markdown/MDX with frontmatter)
- **Categories:** `about`, `sessions` (session-*), `projects` (project-*)
- **Sidebar:** Auto-populates from collection filtering (no manual nav config)

## Pending / In progress
- PR #29: Recent posts + dynamic Clippy quips (E2E tests running)

## Next priorities
1. ✅ Merge PR #29 once CI passes
2. Monitor first scheduled Clippy quip regeneration (Sunday 00:00 UTC)
3. Verify GitHub Actions commit flow (auto-update to clippy-quips.json)
4. Consider future enhancements:
   - Category filtering for recent posts ("Recent Sessions", "Recent Projects")
   - Seasonal Clippy themes
   - Engagement metrics for quip relevance
