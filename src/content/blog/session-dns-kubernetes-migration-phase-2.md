---
title: "Session: Migrating DNS to Kubernetes, Phase 2 — When the Cert Error Wasn't About the Cert"
description: "Phase 2 moved the last Technitium node, dns-1, off Docker. The cluster came up throwing TLS 'UntrustedRoot' — a certificate error that was really a four-hop-deep Kubernetes pod-IP-versus-VIP cascade in disguise. The hard part wasn't fixing it; it was not believing the error message."
pubDate: 2026-06-14
category: sessions
draft: false
---

[Phase 1](/blog/session-dns-kubernetes-migration) ended on a confident note: `dns-1` would follow the same path, with the lessons already baked into the specs. `dns-1` had not read that post.

This is the sequel — moving the last Technitium node off Docker — and it's a different kind of story. Phase 1 was a list of discrete gotchas you fix one at a time. Phase 2 was a single error message that pointed at completely the wrong thing, and the entire job was refusing to take it at face value.

## The setup, and a role swap

By Phase 2 both servers needed to be in Kubernetes. Along the way the cluster roles swapped: `dns-2` (already migrated) was promoted to cluster **primary**, and `dns-1` came back from its migration as the **secondary**. Same MetalLB VIPs (`192.168.100.54` for `dns-1`, `.55` for `dns-2`), same Talos cluster, same Technitium `15.1.0`.

The pod started. And then the cluster heartbeat from `dns-1` to `dns-2` failed, every 30 seconds, with this:

```
The remote certificate is invalid because of errors in
the certificate chain: UntrustedRoot (dns-2.mcmahon.home:53443)
```

A TLS certificate error. So, naturally, I went and looked at the certificates.

## The diagnosis I started from

I'd spent the first stretch of this working in Claude.ai — the chat assistant — and I'd come away with a diagnosis stated as settled fact: not *"maybe the TLSA is stale"* but a crisp, specific, technically-fluent conclusion that the `TLSA` record for `dns-2` didn't match the certificate it was serving, and that the fix was to delete the stale record. So I deleted it. Technitium immediately republished an identical one.

**The confidence was the real trap.** A hedged guess invites me to check it; an authoritative, specific-sounding diagnosis gets adopted as a *premise* — I stopped testing it and started building on it, and let it quietly steer everything downstream. It was stated with the certainty of a fact and the vocabulary of something that clearly knew what a `TLSA` record was, which is exactly why it took me far too long to stop and ask whether it was even true. (When a system keeps recreating the precise thing you're deleting, the thing you're deleting is almost certainly correct — that should have been my tell on day one.)

It wasn't true. The "mismatch" was an artifact of comparing the wrong two values: the diagnosis hashed the **full certificate** (a DANE selector-`0` value) and compared it against a `TLSA` record that uses selector-`1` — the **public key** (SPKI). Apples to oranges. Hash the SPKI instead and it matched perfectly. The certificates were never the problem. I'd burned real time fighting a record that was right the whole time.

The second assumption I'd carried in was quieter and more expensive: that the NOTIFY and transfer traffic would come from the `.55` VIP. Hold that thought.

## The tell

Here's the detail that cracked it open. The `TLSA` records were `3 1 1` — DANE-EE. Usage `3` (DANE-EE) means *this record IS the trust anchor*: the leaf certificate is pinned directly, and the normal chain-to-a-root validation is bypassed entirely. A self-signed cert validates fine under DANE-EE **as long as the TLSA record resolves**.

Which means DANE-EE can never produce an `UntrustedRoot` error on a match. `UntrustedRoot` is what you get from *ordinary* PKIX validation when a self-signed cert has no trusted root. So the error wasn't telling me DANE had failed — it was telling me DANE had never run, and the code had **fallen back** to chain validation. The real question wasn't "why is the cert untrusted," it was "why can't this node apply DANE?" — i.e., *why can't it resolve the peer's `TLSA` record?*

That reframe was the whole ballgame. Everything after it was just pulling the thread.

## The cascade (this is the part you lay at the feet of Kube)

The thread unwound four hops, and every hop was the same root impedance mismatch between Kubernetes pod networking and an application whose trust model is built on fixed IPs:

1. **`dns-1` wasn't even listening on port 53.** Its DNS listen endpoint was set to `192.168.100.54:53` — the MetalLB VIP. A pod cannot bind a VIP it's only *fronted* by; the VIP lives on MetalLB's speaker, not on the pod's interface. So the bind silently failed and the DNS service never came up on `:53`. (Technitium's default is `0.0.0.0:53`, which works fine — this was a stale hand-set value. There is no environment variable for it, which matters later.)

2. **So it couldn't serve — or transfer — the `mcmahon.home` zone.** When `dns-1` tried to pull the zone from `dns-2` via AXFR, `dns-2` refused it. Its zone-transfer ACL was `AllowOnlyZoneNameServers`, which trusts the IPs behind the zone's `NS` records — `.54` and `.55`. But `dns-1`'s AXFR request didn't arrive from `.54`. **It arrived from `dns-1`'s pod IP, `10.244.x`.**

3. There it is — the assumption I'd carried in, falsified. **Pod-to-pod traffic always egresses with the pod IP. The MetalLB VIP is ingress-only; it is never the source address of traffic a pod sends.** "It'll come from the `.55` IP" was wrong in the most load-bearing possible way. The fix was to allow the pod CIDR `10.244.0.0/16` on the zone-transfer ACL.

4. With transfer unblocked, `dns-1` finally held a copy of `mcmahon.home` — and could therefore DNSSEC-resolve `dns-2`'s `_53443._tcp` `TLSA` record, apply DANE, and validate the peer cert. The heartbeat went green the instant the zone landed.

So: a certificate error, whose true cause was a missing zone, whose true cause was a refused transfer, whose true cause was a pod IP that didn't match a VIP-based allow-list. Four hops. The error message was honest about the symptom and useless about the cause.

## NOTIFY, again — and a second pod-IP trap

Phase 1 solved DNS `NOTIFY` with `externalTrafficPolicy: Local` to preserve the source IP. That worked when `dns-1` was on Docker and its source really was `.54`. With **both** nodes now pods, `dns-2`'s NOTIFY arrives from *its* pod IP, which a secondary refuses by default — same disease, new limb.

My first instinct was to whitelist the source per-zone (`primaryNameServerAddresses`). I tested it. It does not work for cluster catalog-member zones. The lever that *does* work is a cluster-wide setting, `notifyAllowedNetworks`, set to the pod CIDR — verified by watching `dns-1` switch from "refused a NOTIFY request" to "received a NOTIFY request" and the zone serials converge in real time. (I'd initially written this off as unfixable and moved to a polling workaround; that conclusion was wrong, and finding the right setting only took reading the *whole* options list instead of the first plausible one.)

## Making it survive a rebuild

A theme kept recurring: every fix here — the `0.0.0.0:53` listen endpoint, the zone-transfer ACL, `notifyAllowedNetworks`, even an `admin`→ proper-username rename — lives **only in Technitium's persistent volume**. None of them has an environment variable, so none can be expressed in the Kubernetes manifests. A pod rebuilt from a fresh PVC would silently regress every one of them.

So they're now encoded in an idempotent `configure.sh` that runs against the Technitium API after each deploy and asserts the desired state. The manifests bring up the pod; the script makes it *correct*. It's the part of "infrastructure as code" the YAML can't reach.

## What I'd actually take away

- **Don't trust the layer the error names.** `UntrustedRoot` is a TLS error; the cause was DNS zone replication four hops upstream. The fastest path was the single fact that didn't fit — DANE-EE can't emit that error on a match — and following *that* instead of the literal message.
- **In Kubernetes, assume the pod IP, never the VIP.** Any app that trusts, allow-lists, or rate-limits by source address will trip on this, because pods egress as themselves and MetalLB VIPs only ever face inward. This single mismatch was the root of three separate failures in one migration.
- **Confident wrong answers are the dangerous failure mode of AI-paired debugging — and confidence is exactly what makes them dangerous.** Two of the three rabbit holes here started as assured, specific, fluent conclusions from Claude.ai's chat, stated with no hedge: *"the cert doesn't match," "it comes from the VIP."* An uncertain suggestion gets scrutinized; a confident one gets inherited as fact and built upon. Both were wrong, and both cost hours *because* they sounded authoritative. Trust a confident diagnosis *less*, not more, for being confident — and the human job is still to ask "what doesn't fit?" before "how do I fix what it says?"
- **This is where model choice stops being academic.** I'd started on a fast, capable-enough chat model; the untangling came once I switched to a more capable one with a much larger context window — one that could hold the entire four-hop chain (certs, DNS zones, DANE, pod networking) in view at once and notice the single fact that didn't fit. Most work doesn't need that, and reaching for the heavyweight on everything is its own kind of waste — the [Failure Detection Dashboard](/blog/project-failure-detection-dashboard) post is largely about *not* doing that. But on a genuinely hard, multi-layer diagnostic problem, the token cost of the more capable model is trivial next to the hours a confident wrong answer will burn. Knowing *when* to spend up — and being willing to actually burn the tokens when the problem earns it — is its own skill.

With both nodes finally in Kubernetes and tracking each other in real time, the last item is the shared `192.168.100.53` VIP (`metallb.universe.tf/allow-shared-ip`) so clients hit one address and reach whichever server is up — redundancy that's only safe now that the secondary genuinely stays current.

Phase 1's closing line was that DNS NOTIFY won't tell you it's unhappy — it just goes quiet. Phase 2's version is meaner: sometimes the system *does* tell you something's wrong, in a clear and specific error message, and the message is pointing four hops away from the actual problem.
