---
title: "The Blog That Could Not Mail"
description: "The newsletter on this site has never sent an email. Not one, in five and a half months. Pre-commit checks, a multi-browser CI suite, a merge gate, RPC-only database access and a cron secret all stayed green the whole time, because every one of them was pointed at something other than the thing that broke. The only alarm was a vendor telling me an SMTP key was about to expire."
pubDate: 2026-09-23
category: sessions
draft: true
---

The media characterizes AI as the Terminator that's going to take over the world. I think it's more like Darth Vader: "You don't know the POWAAHH OF THE DARK SIDE! I MUST obey my master!"

...except then he flips up the facemask, turns into Rick Moranis, and starts squeaking about the inconvenience of my belt-and-suspenders approach while the trousers drop around my ankles.

## The only alarm was an expiry notice

Brevo emailed to say the SMTP keys were expiring. I asked a simple question - are we sending through Brevo or Resend? - and the answer turned out to be "neither, and never".

```
portfolio_blog.subscribers        4 rows, all verified
portfolio_blog.newsletter_sends   0 rows
```

The subscribe form went live on April 5th. Four people signed up and confirmed. The audit table that records every send has never held a row. The oldest subscriber has been waiting _171 days_ for an email from me, and the first thing that noticed was a vendor warning me that credentials for a send that had never happened were about to go stale.

## GET, not POST

The cron entry in `vercel.json` was correct. `CRON_SECRET` was set. The handler checked it properly. The handler was also this:

```ts
export const POST: APIRoute = async (context) => {
```

Vercel's cron calls its path with a GET. Astro routes by exported method, and a route with no `GET` export answers a GET with a 404. So every night at midnight UTC for five and a half months, the scheduler asked, got a 404, and moved on. The handler's first line never ran. Nothing reached the code that writes the audit row, nothing reached the code that logs errors, and nothing reached the code that would have failed loudly on a bad SMTP password.

```
GET  /api/send-newsletter   404
```

It's in the launch post, too. In April I wrote up the newsletter as "a boring, production-ready feature that works end-to-end", and listed the endpoint as `POST /api/send-newsletter - Vercel cron handler`. The bug was documented on day one, in the post announcing it worked.

## The detour through DNS

Before anyone found the 404, the mail side took the blame, repeatedly. There was no SPF include for Brevo, which looked like a missing authorization and is in fact correct - Brevo sends with its own envelope-from and aligns DMARC through DKIM, so adding the include would have broken alignment. The DMARC report address pointed at Brevo, which looked like residue from an old setup and is part of the working one. And a lookup of Brevo's documented DKIM selector came back empty, which looked like no DKIM and meant the domain uses a different selector.

Each of those was a confident reading of real evidence, and each would have produced a change that made things worse. None of it mattered, because no email had ever got far enough to be judged by anyone's DNS.

## Every safeguard was real, and every one faced the same way

This is the part I'd actually like to be wrong about, and am not.

The site has a pre-commit hook that runs unit tests, a full build and a smoke suite before anything is committed. CI runs Playwright across Chromium, Firefox and WebKit. A merge gate refuses anything that doesn't pass. Subscriber data sits in an isolated schema behind `SECURITY DEFINER` functions so no client ever touches a table directly. The cron endpoint requires a bearer secret. The email layer is behind a provider abstraction with a mock for testing. Belt, suspenders, and a second belt.

All of it was green throughout, and none of it was lying. Every check tested exactly what it said it tested. The subscribe page loaded. The form had an email field. The build built. The secret was checked. What none of them did was stand where the scheduler stands, make the request it makes, and look for the row that proves a send happened.

More tests of the same kind would have caught none of it - and not because the send path was hard to test. The regression test I added today is four lines: for every cron in `vercel.json`, the route file has to export `GET`. It went red against the old handler on the first run. The path was untested because every safety layer on the site was aimed at what a visitor can see, and the one path no visitor ever triggers was the one that was broken.

## Three tests that could not fail

Looking for the test that should have caught this, I found some that couldn't catch anything:

```ts
await expect(page.locator('h1, h2').first()).toBeTruthy();
```

A Playwright locator is an object. Objects are truthy. That assertion passes against a blank page.

```ts
if (formInvalid) {
  expect(formInvalid).toBeTruthy();
}
```

It asserts the condition only after checking the condition is true.

```ts
expect(hasToken >= 0).toBeTruthy();
```

A count is never negative. This one was guarding the token-paste unsubscribe form, which is the only unsubscribe route that survives Brevo's link-rewriting - so the one form subscribers genuinely need could have been deleted without the suite noticing.

None of these would have caught the cron. I'm including them because they share its shape: each one was written so it would pass, and nobody checked it could fail. They've been rewritten, and each was checked by pointing it at something wrong and watching it go red. A test I haven't seen fail is still a test I don't believe - I wrote that sentence here a month ago, about a different system, while this one was quietly 404ing every night.

The handler had its own version, too. If fetching subscribers failed, it returned `200` with `"No verified subscribers"`. A database error reported as a quiet night.

## A fix without a signal is just a quieter bug

The core fix is a one-word rename. The fix that matters is something that notices the next time the pipe goes dry, because this failure's defining property was silence. A cron that never reaches your code writes no log, raises no error and leaves no row. Nothing about the site looked wrong from any angle a person would look at it.

So a green deploy doesn't count as evidence anymore. `newsletter_sends` gaining a row does, and the age of the newest row is going on the dashboard I actually look at. There's a wrinkle there worth admitting: the handler only writes a row when there's something to send, so on a quiet week "healthy" and "dead" still look identical. Fixing that means recording every run, not just every send.

## To the subscribers

Four people signed up. One of them is me, so that's a comfortable 25% of the audience that was never going to complain. Two of you are people I've never met, who filled in a form in good faith and have heard nothing since. Sorry. If this is the first email you've had from this site, it's because it's the first one that ever left - and at least it can tell you why.

And one of them is Dan.

&lt;grips amputated wrist&gt; "Dan....why didn't you tell me??"
