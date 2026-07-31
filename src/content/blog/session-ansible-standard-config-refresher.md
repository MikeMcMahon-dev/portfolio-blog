---
title: "Session: Ansible Standard-Config Refresher — Weekend Reps"
description: "Two weekend sessions building a modular Ansible collection from a bare hypervisor — a control-node hub, a user component, a DNS component that survives cloud-init, dynamic Proxmox inventory, and a born-reachable test node. Plus the rule that kept the AI in the passenger seat."
pubDate: 2026-07-26
category: sessions
draft: false
---

Two sessions over a weekend to knock the rust off Ansible and build something worth showing — the [`standard_config` collection](/blog/project-standard-config-ansible). The interesting constraint wasn't technical. It was that I did the typing.

## The working agreement

I've been pairing with Claude on infrastructure for months, and for most of it the split is obvious: it does the plumbing, I do the judgment. But this project is skill-refresh — the whole point is that *I* can walk into an interview and write a role from muscle memory. So we set a rule up front: for the Ansible and Terraform reps, I drive the keyboard. Claude proctors, grades, and catches mistakes, but it does not run the commands for me. As I put it at the time — they won't let Claude come to the interview.

It still did the plumbing (standing up VMs, wiring Terraform), and it parked the deep tangents to the end of each session so momentum won over completeness. But the reps were mine. That distinction turned out to matter more than I expected; explaining *why* a `group_vars` precedence rule works to a proctor is a very different exercise than having the answer generated.

## Session 1 — the hub and the first component

Built **Cowboy**, the control node — an Ubuntu VM on its own VLAN, with a pinned `ansible-core` in a venv and a proper project layout (`ansible.cfg`, inventory, a project-local `requirements.yml` for collections). I bootstrapped the control node by hand, on purpose: the reps start at the venv.

Then the **`user` component** — accounts, keys fanned out with `subelements`, and NOPASSWD sudo written through a `visudo`-validated drop-in so a typo can't lock the box. First real idempotency check: run it twice, second run is all green, no changes. Shipped as the first collection PR.

We also sorted DNS for the new node the honest way and learned something in the process — the Pi-hole forwards the internal zone to exactly one resolver, not the cluster VIPs, so a naive assumption about where a name resolves would have bitten later. Wrote it down rather than trusting it.

## Session 2 — DNS that survives a reboot, and a born-reachable node

The **`dns` component** was the session's real work, and it's a good example of how much hides behind "just set the nameserver." On modern Ubuntu that means the whole netplan → networkd → systemd-resolved stack, *and* defending it against cloud-init, which loves to regenerate network config on reboot and stomp your resolver. So the component strips cloud-init's per-link nameservers, pins ours via a numbered netplan drop-in, configures `resolved` for DNSSEC and caching, drops a stat-gated static breadcrumb (the resolv.conf symlink broke on me once), and disables cloud-init's network regeneration for durability.

The sign-off bar was two conditions, not one. Idempotent — a second run reports zero changes. **And** functionally verified — `resolvectl` shows the interface actually on our resolver with the public fallbacks evicted. `changed=0` only proves the play did nothing; it doesn't prove the box is right. Those are different claims and I wanted evidence for both.

Then **dynamic inventory**: the `community.proxmox` plugin, filtered to an `ansible-managed` tag, composing each host's address from the guest-agent IP. And a fresh **born-reachable** test node — Terraform-provisioned, tagged, reachable by automation from first boot — to prove the day-0 → day-2 handoff end to end instead of hand-waving it.

## Where it stands

The `user` and `dns` components are done and verified; dynamic inventory works against the live hypervisor; the born-reachable node proved the provisioning story. Next reps: an audit-first hardening component on a throwaway target, Molecule for role testing, Ansible Vault for a real secret, and eventually the AAP layer. The refresher did its job — the collection is real, the practices are current, and I can explain every line of it without the generate button.

Project overview: [standard_config — Born-Reachable Server Provisioning](/blog/project-standard-config-ansible)
