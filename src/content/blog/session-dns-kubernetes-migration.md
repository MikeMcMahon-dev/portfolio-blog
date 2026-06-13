---
title: "Session: Migrating a DNS Server to Kubernetes — What the Tutorials Don't Tell You"
description: "Moving a Technitium DNS secondary from Docker to a Talos Kubernetes cluster. The YAML was the easy part; the hard parts were source-IP preservation for DNS NOTIFY, a self-signed cert missing its SAN, and a binary config that can't be pre-seeded."
pubDate: 2026-06-13
category: sessions
draft: false
---

Running a homelab means you eventually stop asking "should I containerize this?" and start asking "should I put this in Kubernetes?" For me that question finally landed on my DNS infrastructure — specifically migrating a Technitium DNS secondary (`dns-2`) from a Docker VM to a Talos-based Kubernetes cluster.

This post documents what I actually ran into, because most Kubernetes tutorials don't cover production DNS servers — and the failures that cost me the most time were all in the gap between "the pod is running" and "the service actually works."

## The Stack

My homelab DNS runs two Technitium servers in a cluster — `dns-1` (primary) and `dns-2` (secondary) — backed by Pi-Hole for filtering. The Kubernetes side is Talos Linux VMs on a single Proxmox node (`pmx-01`), with MetalLB handing out LoadBalancer IPs from my `192.168.100.x` range.

The plan: migrate `dns-2` first as the lower-risk secondary, validate it fully, then follow with `dns-1`.

Starting and ending state:

| Component | Before | After |
|---|---|---|
| `dns-1` (primary) | Docker-01 (VM 100), `192.168.100.54` | unchanged |
| `dns-2` (secondary) | Docker-02 (VM 101), `192.168.100.55` | Kubernetes (Talos), `192.168.100.55` |
| Pi-Hole | QNAP ContainerStation, `192.168.100.30` | unchanged (filtering only) |

Both servers run Technitium `15.1.0`.

## Writing the Specs

I wrote all the Kubernetes specs myself rather than reaching for Helm or copy-pasting from the internet. For someone building K8s fluency, there's real value in understanding every field. The spec set for a DNS server is more involved than a typical stateless app:

> Namespace → MetalLB IPAddressPool + L2Advertisement → ConfigMap → SOPS-encrypted Secret → PVC (dynamic provisioning via the proxmox-lvm CSI) → Deployment → LoadBalancer Service

Plus `deploy.sh` and `teardown.sh` for clean lifecycle management, all living under `k8s/apps/dns/dns-2/`.

A few things I discovered writing these:

**Technitium's config is a binary format** — you can't pre-seed it via a ConfigMap. Instead you pass environment variables at startup: `DNS_SERVER_DOMAIN`, `DNS_SERVER_RECURSION`, and `DNS_SERVER_ADMIN_PASSWORD_FILE`. That last one is the cleanest Kubernetes pattern — mount a Secret as a file and point the env var at the path. I left `DNS_SERVER_FORWARDERS` unset on purpose: `dns-2` is internal-only and Pi-Hole handles upstream forwarding.

**The data mount path is `/etc/dns`** — not `/etc/technitium/dns`, which is what I guessed first. Confirmed it with `docker inspect` on the existing container before writing the PVC mount. One `docker inspect` saved a debugging session.

**The `volumes` block is a sibling to `containers`** under the pod spec — not nested inside it. A subtle indentation error that's easy to make and annoying to find.

**Image tags use full semver.** Technitium's Docker Hub tags are `15.1.0`, while the web UI shows the shorter `15.1`. Always verify the actual tag before pinning, or you'll get an `ImagePullBackOff` for a version that "exists."

## The NOTIFY Problem

Once `dns-2` was running in Kubernetes and joined to the cluster, zone data synced correctly — but `dns-1` kept reporting NOTIFY failures for `dns-2`. The zones resolved fine on both servers, yet `dns-1` couldn't push zone-change notifications to `dns-2`.

The culprit: `externalTrafficPolicy: Cluster`, the default. With this setting, kube-proxy SNATs incoming traffic so the pod sees a cluster node IP rather than the actual source. When `dns-1` sent a NOTIFY to `192.168.100.55:53`, it arrived at the pod appearing to come from some random node IP. Technitium didn't recognize the source and silently dropped it.

The fix is one line in the Service spec:

```yaml
externalTrafficPolicy: Local
```

This preserves the original source IP all the way to the pod. Immediately after applying it, NOTIFY packets from `dns-1` started arriving and zone changes propagated within seconds.

This is the lesson that generalizes beyond DNS: any protocol that makes decisions based on the client's source IP will misbehave behind the default service policy. NOTIFY is one; so is anything with IP allowlists or per-source rate limits.

## The TLS Wrinkle

Technitium cluster communication uses HTTPS, and the self-signed certificate it generates by default only includes the short hostname as the CN — not the FQDN or the IP. When `dns-2` (now in Kubernetes) tried to connect to `dns-1` at `192.168.100.54:53443`, the TLS handshake failed with `RemoteCertificateNameMismatch`.

The fix: in Technitium's **Settings → Web Service**, change the *Web Service Local Addresses* field from `[::]` to the server's specific IP (`192.168.100.54`). Technitium then regenerates the self-signed cert with the IP included as a SAN, and the cluster join succeeds.

One non-obvious operational detail here: **`docker restart` is not enough** to make that take effect. A plain restart doesn't re-evaluate network config — you need `docker compose down` followed by `up` to recreate the container with fresh network bindings. I burned time restarting and watching nothing change before that clicked.

## Re-joining the Cluster

With certs sorted, the actual re-join from the `dns-2` web UI:

1. Break the existing (broken) cluster membership on `dns-2` first.
2. **Administration → Join Cluster.**
3. Primary Node URL: `https://dns-1:53443` — this must match the cert CN.
4. Primary Node IP: `192.168.100.54` — supplied explicitly so the join bypasses DNS resolution from inside the pod (chicken-and-egg: the DNS server can't depend on DNS to bootstrap).
5. Accept the self-signed cert prompt.
6. Enter credentials when prompted — the credential fields sit below the fold in the UI, which is easy to miss and looks like a silent failure if you don't scroll.

## Verification

After everything connected, I verified the full NOTIFY cycle through the Technitium API rather than trusting the UI's green checkmarks:

```bash
# Add a test record on dns-1
curl -sk "https://192.168.100.54:53443/api/zones/records/add?zone=mcmahon.home&domain=notify-test.mcmahon.home&type=A&ipAddress=1.2.3.4&token=$TOKEN"

# Confirm it propagated to dns-2
dig +short notify-test.mcmahon.home @192.168.100.55

# Clean up
curl -sk "https://192.168.100.54:53443/api/zones/records/delete?zone=mcmahon.home&domain=notify-test.mcmahon.home&type=A&ipAddress=1.2.3.4&token=$TOKEN"
```

Record added, propagated, deleted, confirmed gone. Migration complete.

## What's Next

`dns-1` follows the same path, with the lessons from this migration already baked into the specs. Once both servers are in Kubernetes, I'll consolidate them onto a shared MetalLB VIP (`192.168.100.53`) using `metallb.universe.tf/allow-shared-ip`.

The hardest part of migrating DNS to Kubernetes isn't the YAML — it's understanding how Kubernetes networking interacts with protocols that care deeply about source IPs. DNS NOTIFY is one of them, and it won't tell you it's unhappy. It just goes quiet.
