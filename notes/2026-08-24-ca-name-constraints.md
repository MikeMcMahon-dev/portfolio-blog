# Session notes - 2026-08-24 - name-constraining the internal root CA

Raw material for a session post. Two threads, both worth writing: the trip hazard we hit, and how
different the tooling felt this time. Voice reminders: " - " not em-dashes, no bolded paragraph
leads, no count-announcements, honest about the failures.

## Thread 1 - the trip hazard: correctness you cannot observe

The whole session started from a reminder that had been invalidated, which turned up scripts that
had never been updated in prod. The cert-renewer fix sat in git for 50 days while the cluster kept
running the old script. Nothing was broken. That is the point.

The same shape showed up again inside this session. Enumerating the cluster for copies of the root
CA found three, not one:

- `step-ca/step-ca-step-certificates-certs` - the CA's own root, Helm-managed
- `monitoring/cert-renewer-internal` - the renewer's own copy, used to verify step-ca over mTLS
- `k8s/apps/pki/step-ca/root_ca.crt` in the repo - the declaration

Nobody had accounted for the second one. And here is the hazard: the new root reuses the old root's
key and subject DN, so a stale copy in the renewer keeps verifying successfully forever. It renews
certs. It exits 0. It produces no symptom at all while being wrong.

The rule worth writing down: for any config that exists in more than one place, ask what would break
if this copy went stale. If the answer is "nothing visible", it does not need a monitor, it needs a
comparison check. Monitors watch symptoms. There are no symptoms here.

What we built instead of hoping: `check-ca-drift.sh` compares the repo's declared root against both
in-cluster copies and asserts the live root actually carries the constraints. It fails closed - no
kubectl, no cluster access, unreadable ConfigMap all mean FAIL, not "probably fine".

Structural cause worth explaining in the post: the certs ConfigMap is Helm-managed and `values.yaml`
does not template it, so the root lives there as a `kubectl patch` and a `helm upgrade` will revert
it. The chart's `inject` mode is all-or-nothing - turning it on would template the CA private keys
and passwords from values too. So the choice was: put the entire CA including keys into a SOPS'd
values file, or accept the revert and make it loud. We took loud. Detection at a fraction of the
blast radius, and it moves no key material.

Honest loose end: that drift check still has no schedule. It runs when somebody runs it, which is
exactly the gap that let the cert-renewer fix rot for 50 days. Writing the check is not the same as
closing the gap, and the post should say so rather than end on a tidy note.

### Two more traps from the same session

**Replace, never add.** The old and new roots share a key and a subject DN. With both trusted, the
chain builds to the unconstrained one and the name constraints are inert. A rollout that installs
the new root without removing the old appears to succeed and accomplishes exactly nothing. Both
install scripts now enforce removal and refuse to proceed if the old root survived from somewhere
they do not control.

**An installer that cannot say "already correct" trains you to ignore it.** Mike ran the macOS
installer twice, because the guidance said it doubled as a state check, and the second run's output
was ambiguous about whether anything had changed. Fixed by making all three installers idempotent:
on a machine already in the desired state they print VALIDATION PASSED and exit 0 without touching
the trust store. Small change, and it is the difference between a script you trust and a script you
squint at.

## Thread 2 - what actually got proven, with numbers

Old root `9B:58:B9:F8:...:24:D3`, unconstrained. New root `82:09:BC:DE:...:66:3D`, same key, same
subject DN, critical name constraints permitting `mcmahon.home`, `mcmahon-net.us`,
`svc.cluster.local`, `localhost`, and the .100/.110/.130 RFC1918 ranges. VLAN 20 (IoT) excluded on
purpose so the CA structurally cannot vouch for anything in it.

The question the ADR hung on: OpenSSL enforces name constraints, but does Apple? Tested with a
1-hour `evil.example.com` leaf signed straight off the intermediate:

| test | result |
|---|---|
| `/usr/bin/curl` to a local server presenting the forged leaf | rejected |
| same, control leaf for a permitted name | 200 |
| `security verify-cert`, forged leaf, anchor = constrained root | CSSMERR_TP_INVALID_CERTIFICATE |
| `security verify-cert`, same forged leaf, anchor = old unconstrained root | verification successful |

Same certificate, same chain, same policy. Only the anchor differs. That is the proof, and it is the
shape every enforcement claim should have - change one variable, not the whole setup.

Repeated on an iPhone the same evening, because macOS proving it says nothing about iOS: permitted
name loads, `evil.example.com` gets "this connection is not private". Same root, same intermediate,
same server, only the leaf name differs. Worth making the point in the post that the *control* is
what makes the failure mean anything - a certificate warning on its own is equally consistent with
"you never trusted the root", which is the boring explanation and the one that would have been true
if the trust toggle had been missed.

Two false leads worth including because they cost real time:

- `security verify-cert -r` makes a certificate a trust *anchor*. Passing the intermediate that way
  anchors the chain below the root, the root's constraints are never consulted, and the forged cert
  verifies clean. That produced a confident "Apple does not enforce this" reading that was entirely
  an artifact of the wrong flag. `-c` is the chain flag, leaf first.
- Apple's rejection is the generic CSSMERR_TP_INVALID_CERTIFICATE, and curl renders it as
  "unable to get local issuer certificate", which reads like a missing intermediate and is not.
  Related: the previous session lost a cycle to the same phrase for a genuinely different reason -
  building the root from just the CN argument silently drops `O=SpectreNet Internal CA`, the subject
  DN stops matching the intermediate's issuer, and you get the identical error. One error string,
  three unrelated causes.

Nice side effect: step-ca itself now refuses to issue outside the permitted set, reading the
constraints off the root - `DNS name "evil.example.com" is not permitted by any constraint`. That is
why the forged leaf had to be signed directly off the intermediate key, which is what an attacker
holding that key would do anyway.

## Thread 3 - the tooling got noticeably better

This is Mike's observation and it belongs in the post as a first-person note, not a product pitch.

Mid-work messages now surface to the model much sooner. Concretely, twice in this session a comment
typed while a tool call was in flight landed inside the same turn and changed what happened next:
the idempotency feedback reshaped three installer scripts before the turn ended, and a request for a
PM-agent review of the ADR got folded into the same turn's plan rather than waiting for a handoff.
The effect is that the session feels like a conversation with someone working, instead of a series
of batch submissions.

Also worth a line: a review agent ran in the background against the ADR while the main thread kept
working, and the permission classifier blocked the production ConfigMap writes and the pod exec.
That last one is friction, and it is honest to say so - but the shape it forced (hand over
paste-ready commands, human runs them, model verifies the result) is not a bad shape for prod.

## Thread 4 - merged, then erased (the best instance of the theme)

Found while cleaning up a planning repo at the end of the session. A PR is reported MERGED by
GitHub, with a merge commit SHA. That commit does not exist - not in main's history, not locally.
Main's tip is still the previous PR's merge from the day before. The content it carried was simply
gone, and stayed gone for four months while work continued on the branch.

Cause: main was rewritten and force-pushed from a clone that predated the merge. The merge landed
and was then erased by an unrelated operation. Nothing errored. GitHub still cheerfully reports the
PR as merged today, because from its point of view it was.

This is the strongest version of the day's theme and probably the one to open or close on. The
cert-renewer script was fixed in git and not running. The renewer's copy of the root would have
kept working while stale. And here a merge reported success and left no trace. Three different
layers - a config copy, a deployment, a git history - and the same failure: the system reports the
state it intended, not the state it has.

Write it without naming the operation that caused the force-push; it is not the interesting part
and it does not need to be in a public post. "A history rewrite on main" is the whole story.

## Thread 5 - I reproduced the bug I had fixed four hours earlier

This one is mine and it should go in the post, because it is the most useful thing that happened.

The morning's cert-renewer work found, among other things, that a failed Kubernetes Secret PATCH was
reporting success: the script ran `curl -sS`, which exits 0 on an HTTP 403 or 500, and then printed
"patched" unconditionally. A renewal that silently fails to install is indistinguishable from one
that worked, until the certificate expires. Fixed by inspecting the status code.

That afternoon I wrote the monitoring job that watches the CA for exactly this class of problem. The
first draft pushed its metrics with `curl -s`, checked the exit status, and reported success. Same
defect. Four hours later. In a script whose entire purpose is catching things that lie about
succeeding.

It got caught because I ran the failure path - pointed the push at a deliberately wrong URL to prove
the job could go red - not because I reviewed the code. Reading it, it looked right. It looks right
in the morning's version too, which is why it survived in production for weeks.

Why it happens is worth a paragraph, because "the AI was careless" is the wrong read and leads to
the wrong defence. `curl -s ... && echo done` is one of the most common idioms in shell. Writing new
code, the pull toward the idiom is enormous, and the morning's fix was stored as an *edit to one
file*, not as a rule that curl's exit status does not reflect HTTP status. Knowing something in
context is not the same as it constraining what gets generated. Worse, the defect is an *absence* -
a check that is not there - and absences are close to invisible when you are producing the shape of
a working thing rather than interrogating it. That is also why it survived weeks in the renewer:
every human who read it saw a line that looked exactly like ten thousand other correct lines.

The same thing then happened a third time in the same session, in the script that places the Grafana
tile: it shifted panels down on every run and never shifted them back, so the layout crept. Caught
by running it twice and diffing, not by reading it.

The lesson for anyone working with agents, and the reason this belongs in the post rather than in a
private cringe: **fixing a bug does not inoculate the next file against it.** An agent that just
diagnosed a failure mode in detail will reproduce that exact failure mode in new code it writes
minutes later, with complete confidence, because the fix lived in the edit and not in the model of
what is dangerous. The defence is not a better memory - and it is not a more careful reader either,
since three sets of eyes read `curl -s` and saw nothing. It is mechanical: run the failure path on
everything you build, every time, including the thing you built to catch failures. Point the push at
a URL that 404s. Run the idempotent script twice. Set the threshold to zero and confirm it goes red.
Those take a minute each and they are the only step in this whole session that actually caught
anything.

## Audience framing (Mike's steer)

The merged-then-erased story is aimed at **people starting to work with agents**, not at PKI people.
That changes the emphasis: the point is not "git can lose a merge", it is that an agent - or a
person - reads "MERGED" off GitHub, reads "committed" off a repo, reads "deployed" off a ConfigMap,
and treats each as evidence the thing is true. Every one of today's three failures is a status
report standing in for a fact nobody checked. The habit worth teaching is cheap: check the artifact,
not the report. Does the merge commit exist. Does the running ConfigMap match the file. Does the
client actually reject the cert.

That also makes the post useful to someone who has never touched a CA, which the PKI framing alone
would not.

## Candidate angles

- "Three copies of the same certificate, and only one of them mattered"
- "The failure that looks like success" - both roots trusted, constraint inert
- "Nothing broke for 50 days" - as the opener, since it is where this started
- "Reported merged, never merged" - the strongest single instance, good as the closer
