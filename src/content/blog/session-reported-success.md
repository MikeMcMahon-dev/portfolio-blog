---
title: "Exit Code Zero Is Not Evidence"
description: "A day that started with a name-constrained root CA and turned into a study of status reports that were not facts: a fix that sat merged and undeployed for 50 days, three copies of a certificate where a stale one would have worked forever, a curl call that reported pushing metrics it had not pushed, and a pull request GitHub still says it merged into a commit that does not exist."
pubDate: 2026-08-24
category: sessions
draft: false
---

The plan was to put name constraints on my internal root CA. An unconstrained root can sign a valid certificate for any name in the world, and mine was about to go onto my wife's and daughter's phones, which meant the traffic a compromised key could forge for was precisely the traffic they generate.

That work went fine. What the day turned into was something else: four separate cases of a system reporting a state it did not have, in four different layers, none of which produced a symptom.

## Nothing broke for 50 days

The morning started with a reminder firing about a certificate renewer. The fix it referred to had been committed on July 5th.

The ConfigMap the CronJob actually mounts was created on July 4th and still held the pre-fix script. So the cluster had been running the broken version for _fifty days_ while the repository showed it fixed. Nothing alerted. The renewer's state volume held nothing but `lost+found`, and no successful job had ever been retained despite the history limit saying three.

Running it for real against Let's Encrypt staging then found three more, none of which were visible from reading the code. DNS validation was failing because the propagation check passes as soon as one resolver returns the right record, which is not the bar Let's Encrypt applies - it validates from several vantage points, and the zone's four nameservers demonstrably run different serials mid-propagation. The wildcard private key was being written to the pod log on every successful run, because the API echoes the patched Secret back and the script printed the response. And a failed write reported success, because `curl -sS` exits 0 on an HTTP 403 and the script then printed "patched" unconditionally.

Hold onto that last one.

## Three copies of the same certificate

The CA work itself was straightforward. Reissue the root with critical name constraints, reusing the existing private key and subject, so the intermediate and every leaf below it still validate and nothing needs re-minting. Permit the internal domain, the public domain whose names resolve to private addresses, and the private address ranges the certificates carry as IP SANs. Deliberately exclude the IoT VLAN, so the CA structurally cannot vouch for anything in it.

Then I went looking for where the root was actually deployed, and found three copies rather than one: the CA's own ConfigMap, the repository file that gets handed to devices, and a third nobody had accounted for - the renewer keeps its own copy to verify the CA when it renews.

That third one is the interesting failure. The new root reuses the old root's key and subject, so a stale copy in the renewer keeps verifying successfully. Forever. It renews certificates, exits zero, and produces no symptom at all while being wrong.

Which gives a rule worth having: for any config that exists in more than one place, ask what breaks if this copy goes stale. If the answer is "nothing visible", it does not need a monitor. Monitors watch symptoms, and there aren't any. It needs a comparison against a declared value.

## The failure that looks like success

The property that makes the whole rollout fragile is this: old and new root share a key and a subject DN, so if both are trusted, the chain builds to the unconstrained one and the constraint does nothing.

```
evil.example.com against the NEW constrained root:  permitted subtree violation
evil.example.com with BOTH roots trusted:           OK
```

A rollout that installs the new root without removing the old achieves exactly nothing while appearing to succeed. Every install script now removes first and refuses to proceed if it could not.

## Proving Apple enforces it

OpenSSL enforcing name constraints is not evidence that macOS does, and macOS is not evidence that iOS does. Both claims needed a violating certificate rejected on a real device.

The forged leaf had to be signed directly off the intermediate, because the CA itself now reads its own root's constraints and refuses to issue outside them - defence in depth, and not the thing under test, since an attacker holding the key does not ask the CA politely.

```
same forged cert, anchor = OLD unconstrained root : verification successful
same forged cert, anchor = NEW constrained root   : CSSMERR_TP_INVALID_CERTIFICATE
```

Same certificate, same chain, same policy. The only variable is the anchor. That is the shape every enforcement claim should have: change one thing, not the whole setup.

Two things cost me time and are worth passing on. Apple's rejection is the generic `CSSMERR_TP_INVALID_CERTIFICATE`, which curl renders as `unable to get local issuer certificate` - a message that reads like a missing intermediate and is not. And `security verify-cert -r` makes a certificate a trust *anchor*: I passed the intermediate that way, which anchored the chain below the root, so the root's constraints were never consulted and the forged certificate verified clean. I had a confident, entirely wrong "Apple does not enforce this" for about ten minutes, produced by the wrong flag.

The iPhone test needed the forged name to resolve, so it got a temporary local DNS record pointing at my laptop. dnsmasq generates a matching reverse record for every such entry, and macOS derives its hostname by reverse-resolving its own address when one is not explicitly set. My shell prompt read `claude @ evil` for the rest of the afternoon. Despite the attestation, I heard no Mr. Burns-style snickering from the speakers. Perhaps my volume was set too low.

## The bug I had fixed four hours earlier

The afternoon's job was a monitor: run the drift comparisons hourly, emit certificate expiry, push it all to Pushgateway, put it on the dashboard. A check with no schedule is a decoration, and that was the loose end the whole day had started from.

The first draft pushed its metrics with `curl -s`, checked the exit status, and reported success.

Same defect as the morning. Four hours later. In a script whose entire purpose is catching things that lie about succeeding.

It got caught because I pointed the push at a deliberately wrong URL to prove the job could go red, not because I reviewed the code. Reading it, it looked right. It looks right in the morning's version too, which is exactly why it survived in production for weeks.

Why it happens is worth more than a wince, because "the AI was careless" is the wrong read and leads to the wrong defence. `curl -s ... && echo done` is one of the most common idioms in shell, and the pull toward the idiom while generating code is enormous. The morning's fix was stored as an edit to one file, not as a rule that curl's exit status does not reflect HTTP status. Knowing something in context does not constrain what gets produced. And the defect is an *absence* - a check that is not there - which is close to invisible while you are producing the shape of a working thing rather than interrogating it.

It happened twice more the same day, in the script that places the dashboard panel. First it shifted every panel below it down and never shifted them back, so the layout crept nine rows per run. I fixed that, then the fix "undid" a shift that the new placement had never performed, and dragged the entire dashboard up six rows per run instead. Both times the code read fine. Both times running it twice and diffing showed it immediately. Both times I had to restore the layout from a backup, which I had at least taken before writing.

## Reported merged. Never merged.

The last one showed up while tidying a planning repository at the end of the day, and it is the best of them.

A pull request from May is reported MERGED by GitHub, with a merge commit hash. That commit does not exist. Not in the branch's history, not locally, nowhere. The default branch's tip is still the previous pull request's merge from the day before, and the content that one carried had simply been gone for four months while work continued on the branch.

The cause is mundane: the branch was rewritten and force-pushed from a clone that predated the merge, and the merge went with it. Nothing errored. GitHub still cheerfully reports it as merged today, because from its point of view it was.

Four layers, same failure. A config copy that keeps working while stale. A script fixed in git and not in the cluster. A push that says "pushed" after a 404. A merge that reports success and leaves no trace.

## What I'd take from it

Every one of these was a status report standing in for a fact nobody checked. An agent - or a person - reads MERGED off a pull request, reads "committed" off a repository, reads "deployed" off a ConfigMap, reads exit code 0 off a command, and treats each as evidence that the thing is true.

So the habit is cheap and it is not "be more careful", because careful reading found none of these. Careful reading is what produced several of them.

Check the artifact, not the report. Does the merge commit exist. Does the running ConfigMap match the file. Does the client actually reject the certificate. Then run the failure path on everything you build, including - especially - the thing you built to catch failures: point the push at a URL that 404s, run the idempotent script twice and diff, set the threshold to zero and confirm it goes red.

Each of those takes about a minute, and they were the only steps all day that caught anything.
