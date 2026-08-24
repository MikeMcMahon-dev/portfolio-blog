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
- Voice: first-person, technical, dry humor, honest about failures - see the Voice section below,
  which is derived from Mike's own edits, not from taste
- Blog posts live in `src/content/blog/`
- Naming: `session-*.md` for session posts, `project-*.md` for project overviews

## Voice — what Mike actually changes

Draft posts get revised by Mike before publishing. These rules come from reading those revisions,
so they are evidence rather than opinion. Apply them while drafting; they are not a post-hoc polish
pass.

### Mechanical tells (these are the AI giveaways, and they are not word choice)

- **Use " - " (spaced hyphen). Never em-dashes.** This is the single most reliable tell. Mike uses
  a spaced hyphen every time.
- **No bolded paragraph leads.** Do not open a paragraph with a bolded phrase followed by a colon
  as a pseudo-heading.
- **No count-announcements.** Do not write "three things stand out" and then enumerate. State the
  things.
- **Descriptive headings are good** - keep them. An earlier critique of mine called them a tell and
  was wrong.
- Lexical slop (delve, tapestry, testament to) is already absent from these drafts. Do not spend the
  pass hunting words; hunt the four items above.

### Register

- **Concrete beats generic, especially when being barbed.** `68ccca7`: I wrote "most teams are
  choosing by vibes"; Mike replaced it with "choosing by whichever model was in last week's
  Substack". Same judgement, sharper, and it sounds like a person who has watched it happen. When a
  generic dismissive word shows up (vibes, hype, buzz), reach for the specific image instead.
- **Humor lands at the end, as an appended beat.** `b4eadec`: "...and it proposes the same fix again
  with equal confidence. And again... and then compliments you when you agree the fourth time." The
  observation is straight; the joke is a tag on the end. Do not distribute wryness through a
  sentence.
- **Emphasis is italic on the number, not a rewrite.** `b4eadec`: "Opus cost _57 times_ what Sonnet
  did". Let the figure carry it.

### Precision of cause

The revision Mike worked hardest is the one where a sentence implied the wrong cause. Original:
"More unit tests would have caught none of it." He twice pushed it toward naming the actual
mechanism, landing on: *"More unit tests would have caught none of it, and not because they weren't
part of the spec provided to the agent. They'd have missed it because the defects lived between
components, and the testing that would have caught them - exercising the wired path end to end -
never ran."* (`b4eadec`, `7640fb4`)

The rule: **a sentence that assigns a cause must assign the right one, and must pre-empt the wrong
one a reader would otherwise assume.** Do not let a tidy line imply that someone failed to ask for
something. Say what actually failed, and say what would have caught it.

### Process

Draft, then hand it over. Mike revises in his own voice; those revisions are the corpus this section
grows from. When he changes a line, ask what rule the change implies and add it here rather than
fixing that one line and forgetting.
