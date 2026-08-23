---
title: "Session: Everything Was Wired. None of It Had Ever Run."
description: "Two days on OpenBrain's ingest gate and retirement airlock. Both were built, reviewed, merged, and covered by tests. Neither had ever executed once. What surfaced when they finally did: a foreign key that made deletion impossible, a smoke check that could not fail, migration files that lied about their own status, and an anon role that could have emptied the vault."
pubDate: 2026-08-23
category: sessions
draft: false
---

OpenBrain got a plan/apply handshake a couple of weeks back. You call `plan_ingest`, it shows you the living docs already in scope, hands you a short-lived token bound to the exact content, and the ingest won't commit without it. Terraform plan, for a knowledge vault.

It shipped behind a flag. `OPENBRAIN_REQUIRE_INGEST_PLAN` was off, which is the sensible way to ship a gate.

It also meant nobody had ever walked the enforced path. Oops!

## Turning the flag on would have broken every session wrap

The first thing to fix was `ob_ingest.py`, the script I wrap sessions through. It sends no `plan_token`, so the moment enforcement flipped, every wrap would 409. Including the WAF-workaround path I depend on, which is the whole reason that script exists.

The handoff note from the previous session estimated this at "~10 lines reusing the --plan code path." It wasn't, and the reason is interesting.

Auto-planning gets you past `plan_required`. It does not get you past the next gate, which asks a question: there are living docs in scope, is this an update to one of them or a new note? The plan response contains the candidate list. So the tempting implementation is to read that list and auto-fill `acknowledged_not_updating` from it, and then every wrap "just works."

That would have hollowed the gate out completely. The script would be rubber-stamping its own plan - answering a question by copying the answer key. That's the failure the airlock exists to prevent, rebuilt inside the tool meant to satisfy it.  A gate left wide open is not a gate.

So it stops instead. With living docs in scope and no `--component`, it prints the plan and exits 2, and you re-run declaring either an update or an explicit decline. Designed friction. An ordinary session wrap with nothing similar in the vault sails straight through, because the plan returns no candidates and there's nothing to answer.

## I wrote a fail-open guard and caught it by accident

Declining a close match costs a written reason, above a similarity threshold of 0.75. I had the client read that threshold from the plan response rather than hardcoding it, so there'd be no second copy of a tuned constant to drift.

Then I tested it against content I'd deliberately written to be a near-duplicate of an existing living doc, and it wrote the row.

The deployed server didn't have my change yet, so it returned no threshold. My helper treated "no threshold" as "nothing is close" and waved the write through. Enforcement was also off, so the server-side check never ran either. Both guards fell open, in sequence.

The content scored 0.777. The bar is 0.75.

A gate that cannot evaluate its own rule has to fail closed, not open. It now treats every suggestion as close when the server won't say, bounded by the existing 0.50 floor. Four tests pin it, and reverting the fix turns them red - which I checked, because a test I haven't seen fail is a test I don't believe.

## Trialing enforcement before enabling it found two more

Rather than flip the flag and see, I built a small harness: a proxy that forwards `plan_ingest` to production and captures the `/api/ingest` POST without forwarding it. Real CLI, real plan data, nothing written. Then I fed the captured payloads to the real `verify_apply` with enforcement forced on.

It found blockers that would have shipped.

The first: `verify_apply` read the living-doc identity only from a `component` field. The ADR-008 identity is a `component:*` tag, which is what `ob_ingest --component` actually sends. So a declared update was answered with `decision_required` - rejected for failing to declare the update it had just declared.

The second: the hosted MCP surface hashed the raw `source` while the apply path hashed `source.strip()`. Any document ending in a newline - which is most of them - minted a token that could never validate. That's the Claude connector, the one surface that already plans today.

Both invisible while the flag was off. Both would have surfaced as "why did ingest stop working" an hour after turning it on.

## The airlock's delete path had never executed

Migration 012 built a human-approval airlock for removals: an agent proposes with evidence, a human decides, only an approved request executes. It shipped with zero rows.

The propose and review half is genuinely good. Rationale minimum, method validation, one-open-request-per-target, and a denial memory so a rejected removal can't be re-queued until review fatigue does the deleting.

The execute half had never run. When it finally did:

```
psycopg.errors.ForeignKeyViolation: update or delete on table "knowledge"
violates foreign key constraint "retirement_requests_target_id_fkey"
```

The request table has a foreign key to the row it exists to request the deletion of. Postgres refuses to delete the target because the request still points at it. The airlock's only irreversible operation could never fire.

Then the error escaped as a traceback and left the request marked `approved`, so every subsequent run retried it and failed identically. There was a `failed` status, reachable only from a stale-evidence refusal, never from a raise.

And once deletion did work, the audit record became unreadable, because `cmd_show` inner-joined the row it had just deleted.

All of it in code that reviewed clean and had tests.

## A green light wired to nothing

While checking whether enforcement was safe to enable, I looked at the smoke suite's MCP ingest check. It asserted HTTP 200.

The MCP surface discards the ingest's real status - `status, body = ingest_payload(...)` and only `body` is returned - so a 409 comes back as a 200. The write is an upsert on a content-derived id, so it overwrites one row and the table never grows. `--read-only` doesn't skip it.

There is no outcome that turns that check red. A refusal, a silent no-op and a successful write were indistinguishable, and it had been green and meaningless for months.

That reframed the whole exercise. Every bug across these two days lived in a seam - between a caller and a gate, between one surface and its siblings, between schema and code - and 181 green unit tests ran straight through all of them. More unit tests would have caught none of it. What caught things was running the thing.

## Nobody knew which migrations were applied

Asked whether migration 012 was applied, I couldn't answer from the repo. Supabase's own `schema_migrations` table holds four entries from March and none of the numbered series. Every one had been applied by hand with nothing recorded.

Two files still carried `STAGED - NOT YET APPLIED` headers while their objects were live in production. A header a human has to remember to update is a header that lies.

There's now a ledger, and a checker that verifies each migration against an object that must exist or must be gone, never against prose. `013` is verified by a foreign key's absence, so it can tell "applied" from "written."

```
13/13 applied.   exit=0
```

## Authorization, not authentication

Two handlers took a caller-supplied row id and never checked who owned it. Propose against any id, confirm, and the target is retired - permanently, because the event log is append-only and its foreign key isn't deferrable, so the row can't even be deleted afterwards.

Authentication was fine. The token map correctly resolves who you are. Nothing ever used that answer to decide whether you were allowed to touch the row.

The realistic trigger was never a malicious family member. It's an agent - probably me - passing a stale id and retiring the wrong row inside the right vault. The ownership check does nothing for that case, so confirm now also has to name the row it's about to destroy, and gets told what it would have destroyed if it's wrong.

## anon could have emptied the vault

Last one, found while checking a Supabase linter warning about a table with RLS disabled.

The `anon` and `authenticated` roles held full DML on 15 tables, including `TRUNCATE`. Row-level security does not gate `TRUNCATE`. I proved it in a rolled-back transaction:

```
TRUNCATE as anon: SUCCEEDED (1998 -> 0 rows)   [rolled back, restored]
```

So the vault's protection was never row-level security. It was that nobody had published the anon key - which is a key designed to be publishable. Grants revoked, verified denied, app unaffected.

## What I'd take from it

The rubric I use for "is this deployed" asked whether a capability had a caller. It now asks whether the path has actually run, once, end to end, with the output as the receipt. Wired and exercised are different claims and only the second is evidence.

And when someone offers a test as proof, the question is what result would turn it red. If nothing realistic would, it isn't coverage. It's decoration with a green checkmark.

And one final point - one I consider crucial: you **MUST** work with AI in order to identify where it fails.  The longer you work with it, the more you discover how you need to code, test, and then evaluate.  The testing harnesses built over the last 6-or-so months have made a significant difference in what we catch *before* it hits production.  Trust but verify is still a valid approach, IMO.
