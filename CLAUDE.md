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

## Project Context

- Blog at mikemcmahon.dev — Astro + Vercel
- Audience: engineers. No hand-holding on basics.
- Voice: first-person, technical, dry humor, honest about failures
- Blog posts live in `src/content/blog/`
- Naming: `session-*.md` for session posts, `project-*.md` for project overviews
