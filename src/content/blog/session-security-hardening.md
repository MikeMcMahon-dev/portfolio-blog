---
title: "Session: Securing OpenBrain — Auth, Injection Detection, and Parent Reporting"
description: "Adding bearer token auth to raw API endpoints, a two-layer injection detection gate, a query audit log, and a nightly parent session report delivered via Vercel Cron."
pubDate: 2026-03-29
category: sessions
draft: false
---

OpenBrain had been running in production for a few weeks. The retrieval eval was clean, the Custom GPTs were working, Annie was using it for tutoring. From the outside, it was fine.

From the inside, three things needed fixing before it stayed that way:

1. The raw API endpoints (`/query`, `/search`, `/ingest`) were open to the internet
2. There was no record of what was being queried or ingested
3. Beth had no visibility into what Annie was actually asking

One session. All three fixed and smoke-tested to production.

---

## The Auth Problem

The Custom GPT routes had bearer token auth. The raw endpoints did not.

`require_auth()` went on `/query`, `/search`, and `/ingest`. The implementation is a thin wrapper around `_require_tool_auth` — checks the bearer token against `OPENBRAIN_TOOL_ACCESS_TOKEN`, returns 401 if it doesn't match, passes through in dev environments where the token isn't configured.

Straightforward in description. Slightly less straightforward in practice: `_require_tool_auth` and `_get_token_owner_map` were defined in `chatgpt.py` — which means every other module that needed them had been importing them from there. A latent `NameError` was waiting in production: any deployment where auth tokens were configured would crash `/query`, `/search`, `/ingest`, and `/session_report` the first time they were called.

Fix: moved both functions into `_openbrain_api.py` where they belonged. That was the bug that hadn't fired yet.

---

## The Audit Log

Every call to `query_payload` now writes a row to `public.query_log`:

```sql
-- 001_query_log.sql
CREATE TABLE IF NOT EXISTS public.query_log (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    owner TEXT NOT NULL,
    tenant_id TEXT,
    query_text TEXT,
    result_count INTEGER,
    mode TEXT,
    flagged BOOLEAN DEFAULT FALSE
);
```

`flagged` is the SafeIngest gate's output — more on that below. The audit log is the foundation for parent reporting and, eventually, injection flagging dashboards.

---

## SafeIngest: Injection Detection That Doesn't Tip Off the Attacker

Annie's tutoring system has a problem that most RAG systems don't: the students are also potential ingestor candidates. The vector store backs a tutoring AI with hardcoded pedagogical rules (`SOCrATIC_RULES` in `tutor.py` — Python constants, not prompts, so they can't be overridden by ingested content). But that doesn't mean you want injection attempts getting into the store.

The design constraint: the gate must **fail open** (allow writes) rather than blocking on detection. If you block and tell the user "that content was rejected," you've told them the system is checking for injection patterns. They can probe for what triggers the gate.

So SafeIngest:

1. **Pattern gate** — regex check against known injection signatures. Cost: $0.00. Flags the result; does not block.
2. **Haiku classifier** — only runs when `OPENBRAIN_EXTENDED_CHECKS=true` AND the pattern gate matched. A second opinion on likely positives.
3. **Always allows the write.** Flags go to `query_log.flagged` for parent review.

The `SOCrATIC_RULES` are the real defense — injected content can't override hardcoded Python. SafeIngest is intelligence, not enforcement.

---

## The Session Report

Beth needed visibility into what Annie was doing with the tutoring system. The session report endpoint (`POST /session_report`) fetches the query log for a given owner and date, pulls in any study notes from `public.thoughts`, builds an HTML report, and delivers it via Resend API.

Cross-tenant protection via `require_auth_owner()`: the bearer token's resolved owner must match the payload owner. Mismatched owner returns 403. Validation order matters: 400s (bad request) are caught before 403s (auth failures) — otherwise you leak information about whether an owner exists.

The nightly schedule moved from `pg_cron` (the original plan) to a Vercel Cron Job:

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/session_report", "schedule": "0 21 * * *" }]
}
```

The `pg_cron` extension isn't enabled by default in Supabase. That was the practical reason for the switch. The better reason: the schedule belongs with the application, not the database. `REPORT_CONFIGS` is a JSON array in the Vercel environment — adding a new recipient is an env var change, not a migration.

---

## The Fixes Session (2026-03-30)

The cron fired that night. The report did not arrive. Five root causes, found and fixed the next morning:

| Problem | Root cause | Fix |
|---|---|---|
| Report arrived at 3pm, not 9pm | Cron was `0 21 * * *` UTC = 3pm MDT | Changed to `0 3 * * *` (9pm MDT = 03:00 UTC) |
| No data in report | `REPORT_CONFIGS` owner was `"annie"` | DB stores `"anneliesepaige"` — updated env var |
| Report was empty | Cron queried today UTC; data was yesterday UTC | Added `- timedelta(days=1)` |
| Email failed with 403 | Cloudflare 1010 blocking Resend API calls | Added `User-Agent: openbrain-session-reporter/1.0` header |
| Missing Annie's GPT notes | Report only pulled `query_log` | Added `_fetch_study_notes()` from `public.thoughts` |

Five separate bugs. Each one independently would have produced a broken or empty report. The first actual delivered report landed for `anneliesepaige` on 2026-03-29 data — confirmed.

---

## Production State

26/26 smoke tests green across local, preview, and production (`openbrain-rouge.vercel.app`). The entire auth + audit + injection detection + reporting layer went from design to production-validated in a single session, with the delivery bugs resolved the next morning.

Project notes: [OpenBrain](/blog/project-openbrain)
