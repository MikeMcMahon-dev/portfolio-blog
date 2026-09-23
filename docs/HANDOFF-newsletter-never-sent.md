# Handoff — the newsletter has never sent

**Opened 2026-09-23.** Found while answering an unrelated question: "Brevo emailed me that the
SMTP keys are expiring — are we using Brevo or Resend?"

## The state, measured not assumed

| | |
|---|---|
| `portfolio_blog.subscribers` | **4 rows, all `verified=true`** — 2026-04-05, 04-07, 08-03, 08-09 |
| of those, genuinely external | **2** — the other two are Mike and Dan (Dan already knows about the blog) |
| oldest subscriber has waited | **171 days** |
| `portfolio_blog.newsletter_sends` | **0 rows** — has never sent, not once |
| cron in `vercel.json` | `/api/send-newsletter`, `0 0 * * *` |
| production deployment | current + healthy — `eb7d933`, 2026-09-20, READY |
| serverless invocations, 7-day window | **1 total** (`route=_render`) |

A daily cron produces seven invocations a week. This produced one. **The cron is not invoking
the function.** Two genuine subscribers opted in, verified, and have received nothing.

## There is exactly ONE fault. The mail side is fine.

This was initially read as two stacked faults, with Brevo/SPF as the second. That was wrong.
Brevo's domain authentication is **complete and correct**:

```
apex TXT           brevo-code:c101c6765bfc22da662ed3d1e5bee1fa
brevo1._domainkey  b1.mikemcmahon-dev.dkim.brevo.com
brevo2._domainkey  b2.mikemcmahon-dev.dkim.brevo.com
DMARC              v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com
```

Three things NOT to do, each of which looked right at some point during the investigation:

- **Do not add a Brevo SPF include.** Per Brevo's own docs, SPF and MX are not required to
  authenticate a sending domain — those are for dedicated IPs. Brevo's envelope-from is its own
  domain, so DMARC aligns via **DKIM**. Adding `include:spf.brevo.com` would fail alignment
  because the envelope-from will not match the From: domain.
- **Do not "clean up" the DMARC `rua=`.** It points at `dmarc.brevo.com` because that is part of
  the working Brevo setup, not leftover residue.
- **Do not conclude DKIM is missing** from a `mail._domainkey` lookup. That is Brevo's older
  documented selector. This domain uses `brevo1`/`brevo2` CNAMEs.

The apex SPF (`include:spf.improvmx.com`) is for **inbound** forwarding via ImprovMX, which is a
separate and working concern. Do not touch it while debugging outbound.

## First thing to check

Whether `/api/send-newsletter` is deployed as its own serverless function at all.

The only route ever seen in runtime logs is `_render`, which is the Astro/Vercel adapter's single
SSR entry point. If the adapter is emitting a static build with one SSR function, a cron hitting
`/api/send-newsletter` may be resolving to a static 404 and never reaching application code —
which would explain zero invocations, zero audit rows, and zero errors.

```bash
# does the deployed build actually contain the function?
vercel inspect <production-deployment-url>       # look for the functions list
# and the adapter config:
cat astro.config.mjs                             # output: 'server' | 'hybrid' | 'static'?
```

If the route is not a function, no amount of cron or credential work will help.

Second check: Vercel dashboard → project → Cron Jobs. Confirm the job is listed, enabled, and
shows a last-run time. A cron that has never run at all points at plan limits or a disabled job
rather than at the code.

## In flight, being handled separately

Mike is regenerating the Brevo SMTP keys and updating the four `BREVO_SMTP_*` vars in Vercel
(production **and** preview — they are set on both). Notes:

- `BREVO_SMTP_PASS` is type `sensitive`, so the old value cannot be read back by anyone.
- Sensitive vars are bound at build time. **Redeploy after updating**, or the cron keeps using
  the stale credential.
- `EMAIL_PROVIDER` is currently `brevo` and should stay that way. It is type `encrypted`, so its
  value is readable in the dashboard.

Once the credential is valid, the cron is the only remaining blocker.

## Do not ship a fix without a signal

This ran broken for five months because nothing watched it. A missing cron invocation writes no
audit row, raises no alert, and the subscribe form looks perfect to a visitor. The only signal
that ever arrived was an unrelated vendor expiry notice.

Whatever the fix, add one of:
- a `newsletter_sends` row-count or last-send-age panel on the dashboard Mike spot-checks, or
- a metric pushed from the cron handler (`send-newsletter.ts` is reportedly already instrumented
  for cost metrics — extend that rather than build new plumbing).

A green deploy is not evidence the newsletter sent. `newsletter_sends` gaining a row is.

## The subscribers

Four rows, but two of them are Mike and Dan — so the real audience is **two people**, and Dan has
certainly heard about the blog by other means. That lowers the urgency considerably; this is not a
mailing list full of strangers being ignored.

It does not lower it to zero. Two people opted in and verified, and the silence runs up to 171
days for the oldest row. Whether that warrants a first digest, a short note, or retiring the
subscribe form is Mike's call — worth making deliberately rather than by default.

## Background

Full write-up in OpenBrain under `component:portfolio-blog-mail-path`, which also records why
this took a detour — the ADRs here document the email *abstraction* (provider switching, digest
model, unsubscribe tokens, Supabase as store) and never recorded which provider carries mail or
what DNS authorises it.
