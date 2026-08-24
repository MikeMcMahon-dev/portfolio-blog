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

## Candidate angles

- "Three copies of the same certificate, and only one of them mattered"
- "The failure that looks like success" - both roots trusted, constraint inert
- "Nothing broke for 50 days" - as the opener, since it is where this started
