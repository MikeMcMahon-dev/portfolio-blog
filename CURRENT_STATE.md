# Portfolio Blog — Current State

**Last updated:** 2026-04-07 (Clippy quip generation VERIFIED ✅)

## Build & deployment status
- ✅ **FULLY FUNCTIONAL** — All pages rendering, Clippy generating quips, CI passing
- **Last build:** 2026-04-07 (with recent posts & 31 fresh Clippy quips from Claude API)
- **Prerendered:** 15 blog posts (6 projects, 8 sessions, 1 about, 1 credits, + 2 new session posts)
- **Warnings:** None (Vercel Node version note is informational only)
- **Deprecated packages:** None
- **Site:** https://mikemcmahon.dev (auto-deploys from main branch via Vercel)
- **CI/CD:** ✅ Fully tested and passing (PR #29 merged, PR #30 verification merged)

## Recent enhancements (2026-04-07) — ALL SHIPPED ✅
- ✅ **Dynamic Clippy Quips:** HackerNews + Claude API generation, weekly refresh
  - **Verified working** in CI (generates 31 quips per build)
  - Regenerates every Sunday at 00:00 UTC via GitHub Actions
  - `CLAUDE_API_KEY` secret properly configured in GitHub
  - Auto-commits fresh quips to main when changes detected
- ✅ **Recent Posts Component:** 4 most recent posts on homepage
  - Responsive grid: 1 col (mobile), 2 cols (tablet), 4 cols (desktop)
  - Date-stamped bubbles with titles, descriptions, links
- ✅ **Homepage Polish:** Centered "Built with Claude AI" stamp
- ✅ **CI/CD Pipeline (FULLY TESTED):**
  - Updated Node.js 18 → 22 (Astro 6.1.3 requirement)
  - Playwright browser + system dependencies installed
  - Build steps include env var for quip generation
  - E2E tests pass (chromium, firefox, webkit)
  - Merge gate validates all checks before allowing merge

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

## Shipped & Verified ✅
- ✅ PR #29: Recent posts + dynamic Clippy quips + CI/CD pipeline
  - All unit tests passing
  - All E2E tests passing (Playwright multi-browser)
  - Merge gate validates before production
  - Deployed to https://mikemcmahon.dev
- ✅ PR #30: Clippy quip generation verification
  - Confirmed CLAUDE_API_KEY integration works
  - Both build steps generate 31 quips per run
  - Step-level env vars (secure, minimal scope)

## Next priorities
1. Monitor first scheduled Clippy quip regeneration (Sunday 00:00 UTC, 2026-04-13)
2. Verify GitHub Actions auto-commit flow (will update clippy-quips.json + push to main)
3. Future enhancements (low priority):
   - Category filtering for recent posts ("Recent Sessions", "Recent Projects")
   - Seasonal Clippy themes based on calendar date
   - Quip relevance tracking / engagement metrics
