---
title: "Session: Email Subscription & RSS Feed Implementation"
description: "Building a production-grade email subscription system with daily digest newsletters, Brevo SMTP integration, and solving vendor link-tracking quirks along the way."
pubDate: 2026-04-05
category: sessions
draft: false
---

## What We Built

A complete email subscription system for the portfolio blog with two distribution channels: **daily email digest** and **RSS feed**.

### Core Architecture

**Database Layer** (Supabase):
- Isolated `portfolio_blog` schema (separate from open-brain) containing subscriber data
- `subscribers` table: email, unsubscribe token (unique per subscriber), verified flag
- `newsletter_sends` audit log: tracks what was sent, when, to how many people, and which provider
- RPC-secured stored procedures (functions in public schema, tables in isolated schema) — defense-in-depth against unintended data exposure

**Email Layer** (Brevo SMTP):
- Provider abstraction (factory pattern): `ResendEmailService`, `BrevoEmailService`, `MockEmailService` — switch providers via `EMAIL_PROVIDER` env var
- Daily cron fires at midnight UTC, fetches all posts published since last send, renders unique HTML **per subscriber** with their personal unsubscribe token
- Email template with responsive HTML, post excerpts, unsubscribe options (header + footer)
- Digest model: one daily email at midnight UTC (reduces fatigue vs. per-post notifications)

**API Endpoints**:
- `POST /api/subscribe` — validate email, generate token, insert via RPC
- `GET /api/unsubscribe?token=...` — one-click unsubscribe via token (primary via List-Unsubscribe header)
- `POST /api/send-newsletter` — Vercel cron handler, Brevo auth-gated
- `POST /api/send-unsubscribe-token` — send user their token via email
- `/unsubscribe` page — self-service form (email entry + token paste)

**RSS Feed**:
- Already built (Astro RSS plugin) — automatically includes all non-draft blog posts
- Updated frequency: automatically includes all new posts

### Security Decisions

**The Good**: Defense-in-depth instead of vendor-lock
- Data stored in isolated `portfolio_blog` schema (invisible to open-brain queries by default)
- All table access goes through RPC functions with `security definer` + explicit `grant execute` permissions
- No direct SQL table access from client code
- Public can only INSERT (signup); service_role can select/delete (cron + unsubscribe)

**The Frustrating**: Brevo Link Tracking
- Brevo aggressively wraps all links with click-tracking redirects
- `data-no-track="true"` HTML attribute is supposed to disable tracking but doesn't work reliably
- Query parameters get stripped during redirect, breaking token-based unsubscribe links
- **Solution**: Removed clickable links from unsubscribe confirmations. Token shown as plain text; users paste it on `/unsubscribe` page instead
- Not ideal UX but eliminates vendor-dependency friction

## Key Learnings

### Production Discipline (Early Catch)
We created the subscription UI before the backend was ready, pushed it to main as draft-hidden. This taught us: **partial features should stay on feature branches.** Preview deployments exist for validation. Once merged to main, the code is semantically "live" even if hidden — bad habit to normalize.

### Database Access Patterns
Three approaches to secure isolated schema data:
1. **Views in public schema** (rejected) — single RLS failure exposes everything
2. **Direct table access** (rejected) — relies on vendor's RLS enforcement only
3. **RPC functions** (selected) — layered defense: schema isolation + zero table discovery + explicit permission grants

The RPC route costs more boilerplate but gives you defense-in-depth. Worth it for PII.

### Vendor Quirks as Constraints
When Brevo's link tracking broke tokens, we had three choices:
- Spend more engineering effort on workarounds (diminishing returns)
- Accept the broken feature
- Redesign around the limitation

We chose #3. The token-paste flow is "fiddly but functional" — good enough for now, improvable later without rewriting core logic.

## What's Live Now

- `/subscribe` page with email form + RSS link
- Subscribe navigation links (header, homepage, footer, sidebar)
- Daily cron fires midnight UTC
- Email digests with unique unsubscribe tokens per subscriber
- List-Unsubscribe header (mail client native button)
- Self-service unsubscribe page (`/unsubscribe`)
- RSS feed (automatic via Astro)

## What's Next (Future Sessions)

- **Verification emails**: Double opt-in (send confirmation, require click) for explicit intent
- **Brevo API instead of SMTP**: More control over link tracking and templating
- **Grafana metrics**: Track subscription growth, unsubscribe rate, email delivery success
- **Unsubscribe UX polish**: Direct link in email once we solve the token issue
- **Subscriber management UI**: Let users update preferences without unsubscribing

---

**The big win here**: A boring, production-ready feature that works end-to-end. No vendor lock-in, layered security, and two distribution channels (email + RSS). Users have choices.
