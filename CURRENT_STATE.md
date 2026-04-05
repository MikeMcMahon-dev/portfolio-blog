# Portfolio Blog — Current State

**Last updated:** 2026-04-05 (fixed Vercel build regressions, set up CLAUDE.md + memory system)

## Build & deployment status
- ✅ **Functional** — All pages rendering, build clean
- **Last build:** 2026-04-05 @ 16:28:33
- **Prerendered:** 14 blog posts (6 projects, 8 sessions, 1 about, 1 credits)
- **Warnings:** None (Vercel Node version note is informational only)
- **Deprecated packages:** None
- **Site:** https://mikemcmahon.dev (auto-deploys from main branch via Vercel)

## Recent fixes (2026-04-05)
- ✅ Added `export const prerender = true;` to `/src/pages/blog/[...slug].astro`
- ✅ Updated resend from ^3.2.0 to ^6.0.0 (eliminated deprecated glob)
- ✅ Updated Node constraint to >=18
- ✅ Projects and sessions links fully functional

## Known issues
None currently.

## Infrastructure & dependencies

### APIs & backends
| Service | Purpose | Env var (in .env.local) |
|---|---|---|
| Supabase | Newsletter subscriber DB | `SUPABASE_URL`, `SUPABASE_KEY` |
| Resend | Email delivery (^6.0.0+) | `RESEND_API_KEY` |
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
- None

## Next priorities
1. Continue documenting work in session/project notes
2. Maintain git workflow (feature branch → PR → merge)
3. Monitor build for any new warnings/regressions
