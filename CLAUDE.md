# Claude Code — Portfolio Blog

## Session Startup (required every session)

1. Query OpenBrain for user context
2. Read `memory/MEMORY.md`
3. `git pull origin main` — before any branch, commit, or push work. This repo has active CI automation (Clippy quips, PR merges) that runs between sessions. Never assume local main is current.
4. Check `CURRENT_STATE.md` if continuing prior work

## Hard Rules

### Verify before asserting
Never state a diagnosis, root cause, or explanation as fact unless it has been confirmed. If uncertain, say so explicitly: "I think", "likely", "let me check." A wrong confident answer is worse than an expressed uncertainty. When something fails — a command, a push, a build — run a diagnostic command to confirm the cause before naming it.

### Git workflow
- Never commit directly to `main`
- Always branch first: `git pull origin main` → `git checkout -b <type>/<description>`
- Stage files by name — never `git add -A` or `git add .`
- PR via `gh pr create` — Vercel picks up from there

## Open question — Supabase is shared with OpenBrain

**This blog's Supabase project is the same one OpenBrain's knowledge vault lives in.** Database-level
changes here affect that vault and vice versa, so anything touching roles, grants, or RLS needs to
be considered against both.

On 2026-08-23 the OpenBrain side revoked all `anon` and `authenticated` table grants across the
`public` schema, after finding those roles held `TRUNCATE` on 15 tables — and RLS does not gate
`TRUNCATE`, so the vault could have been emptied by anyone holding the anon key. Newsletter
FUNCTIONS were deliberately left untouched, because they belong to this project and breaking
subscribe/unsubscribe was not that session's call to make.

**What needs a decision here:** eight `SECURITY DEFINER` functions in `public` are executable by
`anon`. They run as `postgres`, so they bypass the grant revoke by design:

`subscribe`, `unsubscribe`, `get_subscriber_by_email`, `get_verified_subscribers`,
`insert_newsletter_send`, `get_last_newsletter_send`, `current_auth_slack_user`,
`current_auth_tenants`

Verified: **none of them read the knowledge vault**, so this is not an OpenBrain exposure. But
`get_verified_subscribers` returns the whole subscriber list to anyone with the anon key, and
`get_subscriber_by_email` confirms whether a given address is subscribed. The anon key is meant to
be publishable — that is the entire point of it — so treat both as public endpoints.

`subscribe` and `unsubscribe` genuinely need anon execute; a signup form has no other credential.
The read functions almost certainly do not — they look like server-side helpers that were granted
along with the rest.

Likely fix, once someone confirms nothing client-side calls them:

```sql
REVOKE EXECUTE ON FUNCTION public.get_verified_subscribers() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_subscriber_by_email(p_email text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_last_newsletter_send() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.insert_newsletter_send(
  p_post_ids text, p_post_count integer, p_sent_at timestamp with time zone,
  p_subscriber_count integer, p_provider text, p_status text) FROM anon, authenticated;
```

Signatures above are read from `pg_proc`, not guessed. The two kept for `anon` are
`public.subscribe(p_email text, p_unsubscribe_token text)` and
`public.unsubscribe(p_unsubscribe_token text)` — the signup form needs both.

`insert_newsletter_send` and `get_last_newsletter_send` are send-pipeline bookkeeping; if the send
job runs server-side with the service key rather than the anon key, they should lose anon execute
too. **Confirm which key the send job uses before revoking** — that is the one call here that can
break a working flow, and it fails at send time, not at deploy time.

Trial anything before applying: `open-brain/scripts/sql_trial.py` runs SQL against prod inside
BEGIN..ROLLBACK and reports whether it would succeed, changing nothing.

**Severity: low.** The subscriber list is two people, one of whom is Dan, who does not read it on
the grounds that the material is too far ahead of him. Worth closing on principle rather than
urgency — an email list that is public by accident stays wrong even when it is short.

## Project Context

- Blog at mikemcmahon.dev — Astro + Vercel
- Audience: engineers. No hand-holding on basics.
- Voice: first-person, technical, dry humor, honest about failures
- Blog posts live in `src/content/blog/`
- Naming: `session-*.md` for session posts, `project-*.md` for project overviews
