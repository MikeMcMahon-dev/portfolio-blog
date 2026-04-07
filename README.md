# Mike McMahon's Portfolio Blog

A production-grade portfolio blog built with Astro, showcasing infrastructure/SRE work, AI experiments, and technical documentation.

**Live:** https://mikemcmahon.dev

---

## 🚀 Features

- **Dynamic Content:** Blog posts in Markdown/MDX with automatic prerendering
- **AI-Powered Easter Egg:** Clippy mascot tells jokes based on trending HackerNews stories (regenerated weekly)
- **Recent Posts Widget:** Responsive homepage section showing 4 most recent posts
- **Email Subscriptions:** Daily digest powered by Supabase + Resend
- **RSS Feed:** Full-text feed of all posts
- **Newsletter Unsubscribe:** Self-service management at `/unsubscribe`
- **CI/CD:** GitHub Actions with build testing, content validation, and E2E testing
- **Performance:** 100/100 Lighthouse, prerendered static routes, serverless functions

---

## 📁 Project Structure

```text
├── src/
│   ├── components/           # Astro components (Clippy, RecentPosts, etc)
│   ├── content/blog/         # Blog posts (Markdown/MDX with frontmatter)
│   ├── data/                 # Data files (hardcoded-quips.ts, clippy-quips.json)
│   ├── integrations/         # Astro build hooks (clippy-quips generation)
│   ├── layouts/              # Page layouts (Base, BlogPost, etc)
│   ├── lib/                  # Utilities (email, database, etc)
│   ├── pages/                # Routes (/, /blog/, /subscribe, /unsubscribe)
│   └── scripts/              # Build-time scripts (generate-clippy-quips.ts)
├── tests/
│   ├── e2e/                  # Playwright E2E tests
│   ├── unit/                 # Vitest unit tests
│   └── utils/                # Test helpers
├── .github/workflows/        # CI/CD pipelines (ci.yml, post-merge-verify.yml, regenerate-clippy-quips.yml)
├── astro.config.mjs
├── package.json
└── CURRENT_STATE.md          # Operational status snapshot
```

---

## 🛠 Quick Start

### Prerequisites
- Node.js 22+ (required by Astro 6.1.3)
- npm 8+

### Installation
```bash
npm install
```

### Development
```bash
npm run dev          # Start dev server (localhost:4321)
npm run dev          # With Clippy quips: npm run build && npm run dev
```

### Build & Test
```bash
npm run build        # Build site + generate Clippy quips
npm run test         # Unit + content tests
npm run test:build   # Build completeness validation
npm run test:e2e     # Playwright E2E tests (chromium, firefox, webkit, mobile)
npm run test:all     # All tests
```

### Clippy Quip Generation
```bash
npm run generate:clippy-quips   # Manually regenerate quips from HackerNews + Claude
```

---

## 📝 Writing Posts

Blog posts live in `src/content/blog/` as Markdown/MDX files with YAML frontmatter:

```markdown
---
title: "My Post Title"
description: "Short summary for preview"
pubDate: 2026-04-07
category: sessions  # or "projects"
draft: false        # Set to true to exclude from build
---

# Content starts here

Your markdown content...
```

**Categories:**
- `sessions` — Technical work logs (appear as "Session Notes" in sidebar)
- `projects` — Long-form project documentation
- `about` — One-off pages (how-i-got-here, credits)

Draft posts are excluded from prerendering and won't appear in navigation.

---

## 🤖 APIs & Services

### External Services
| Service | Purpose | Env Var |
|---------|---------|---------|
| **Supabase** | Newsletter subscriber database | `SUPABASE_URL`, `SUPABASE_KEY` |
| **Resend** | Email delivery (daily digests) | `RESEND_API_KEY` |
| **Claude API** | Clippy quip generation | `CLAUDE_API_KEY` (GitHub Secrets) |
| **HackerNews** | Trending stories for quips | None (public API) |
| **Vercel** | Hosting + serverless functions | Auto-configured |

### Environment Variables
**Local (.env.local):**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
RESEND_API_KEY=re_xxxxxxxx
```

**GitHub Secrets (Actions):**
```
CLAUDE_API_KEY=sk-ant-xxxxxxxx
```

---

## 🔄 CI/CD Pipeline

### `ci.yml` (Pull Requests)
Runs on every PR to `main` or `feat/initial-site-build`:
1. Checkout code
2. Setup Node 22 + npm cache
3. Install Playwright browsers
4. Install dependencies
5. Type check (`astro check`)
6. Build project
7. Run unit + content tests
8. Run build completeness tests
9. Run E2E tests
10. Merge Gate: Allow merge only if all pass

### `post-merge-verify.yml` (After Merge)
Runs after merge to main:
1. Same steps as CI
2. Alert on failure (blocks deployment)

### `regenerate-clippy-quips.yml` (Scheduled)
Runs every Sunday @ 00:00 UTC:
1. Fetch trending HackerNews stories
2. Call Claude API to generate quips
3. If changed: commit + push to main
4. (Can also be manually triggered)

**Requirements:** `CLAUDE_API_KEY` GitHub Secret

---

## 🧪 Testing

### Unit & Content Tests (Vitest)
```bash
npm run test
```
Validates:
- Blog content structure (frontmatter, categories)
- Collection queries
- Helper functions

### Build Tests
```bash
npm run test:build
```
Validates:
- All published posts prerendered
- No draft posts in build output
- HTML completeness (contains titles, headings)
- Proper layout structure

### E2E Tests (Playwright)
```bash
npm run test:e2e
```
Tests across 4 browsers (Chromium, Firefox, WebKit, Pixel 5 mobile):
- Navigation works
- Blog posts accessible
- No 404 errors
- Sidebar consistency
- Content presence
- Component rendering
- Responsive layout
- Subscription form

---

## 🚀 Deployment

### Automatic (Recommended)
Merged PRs to `main` auto-deploy to Vercel. Post-merge verification runs immediately.

### Manual
```bash
npm run build
# Deploy ./dist/ to your host
```

### Health Checks
- **Build:** `npm run build` completes without warnings
- **Tests:** All E2E tests pass
- **Lighthouse:** Run locally with `npm run preview` → inspect

---

## 📊 Performance

- **Prerendered:** 15 blog posts + homepage as static HTML
- **Dynamic:** API routes for subscribe/unsubscribe (serverless)
- **Caching:** CSS/JS versioned, long-term cache headers
- **Images:** Sharp for optimization, next-gen formats
- **Metrics:** 100 Lighthouse score (local build)

---

## 🔧 Development Tips

### Adding a New Post
1. Create `src/content/blog/post-slug.md` with frontmatter
2. Run `npm run build` to prerender
3. Local preview: `npm run dev`
4. Push to feature branch, open PR
5. Merge once CI passes

### Debugging Quip Generation
```bash
CLAUDE_API_KEY=sk-ant-... npm run generate:clippy-quips
```
Check `src/data/clippy-quips.json` output. Fallback to hardcoded if API fails.

### Checking Draft Posts
```bash
grep -r "draft: true" src/content/blog/
```

### Running E2E Tests Locally
```bash
npm run test:e2e:dev  # Opens UI for interactive debugging
```

---

## 📖 Documentation

- **[CURRENT_STATE.md](./CURRENT_STATE.md)** — Operational status, known issues, next priorities
- **[astro.config.mjs](./astro.config.mjs)** — Build config, integrations, adapters
- **Blog Posts** — Technical deep-dives in `src/content/blog/`

---

## 🙋 Contributing

This is a personal portfolio, but internal structure follows best practices:

- Feature branches for work: `feat/`, `fix/`, `session/`
- Always branch from `main`, never commit directly
- Use `/commit` skill for semantic commit messages
- PR required before merge (CI must pass)
- E2E tests catch regressions early

---

## 📜 License

Content and code © Mike McMahon.

Clippy assets: [felixrieseberg/clippy](https://github.com/felixrieseberg/clippy) (MIT)
Clippy character: © Microsoft (used in spirit of Clippy renaissance)

---

## 🤝 Tech Stack

- **Framework:** Astro 6.1.3 (SSR + static prerender)
- **Language:** TypeScript
- **Styling:** CSS with design tokens (--accent, --border, etc)
- **Testing:** Vitest (unit), Playwright (E2E)
- **CI/CD:** GitHub Actions
- **Hosting:** Vercel
- **Email:** Resend (API) + Brevo (SMTP)
- **Database:** Supabase (PostgreSQL)
- **AI:** Anthropic Claude (quip generation)

---

**Last updated:** 2026-04-07
