---
title: "Project: standard_config — Born-Reachable Server Provisioning"
description: "A modular, toggle-driven Ansible collection that takes a freshly-provisioned VM from first boot to fully-configured with no manual bootstrap — dynamic Proxmox inventory, a netplan→networkd→resolved DNS stack, and idempotency that's actually verified, not just green."
pubDate: 2026-07-26
category: projects
draft: false
---

`standard_config` is an Ansible collection that applies a consistent baseline to any new server — a VM, an LXC, a non-Talos Kubernetes worker — the moment it exists. I built it to keep my Ansible skills current and to have a portfolio artifact that demonstrates how I actually structure automation, not a toy playbook. The organizing idea is **born-reachable provisioning**: a node should be reachable by the control plane from its very first boot, so day-0 (Terraform stands up the machine) flows straight into day-2 (Ansible configures it) with no human in the middle typing a bootstrap command.

## The problem with "run the playbook after you SSH in once"

Most homelab automation has an invisible manual step. You Terraform a VM, then you SSH in, create a user, drop a key, maybe fix DNS by hand — *and then* the playbook can run. That first-touch step is where drift and undocumented magic live. It's also the step that doesn't scale and doesn't demo well.

The fix is to push identity and reachability down into the image. The Terraform template's cloud-init seeds a dedicated automation user and its public key, so a freshly-cloned node comes up already reachable *as the automation identity*. Ansible's dynamic inventory discovers it, and the baseline role runs against it — no manual first touch. That's the property the whole project is built around, and getting it fully clean (user baked in, not just a key) is the current frontier.

## Architecture

**A modular, toggle-driven collection.** The collection is one role split into independently-switchable components, so you compose a host's baseline from `group_vars` rather than editing tasks. Components so far:

- **`user`** — accounts, `authorized_keys` fanned out with `subelements`, and NOPASSWD sudo written through a `visudo`-validated drop-in (never edit `sudoers` unvalidated). Fully idempotent.
- **`dns`** — the piece I'm proudest of. It makes a node's resolver authoritative and durable against cloud-init: it strips cloud-init's per-link nameservers with a `replace`, pins the real resolver via a `99-` netplan drop-in, configures a `resolved.conf.d` drop-in for DNSSEC / DoT / caching, leaves a static `/etc/resolv.conf` breadcrumb (stat-gated, because the symlink broke once), and disables cloud-init's network regeneration so a reboot can't undo the work.

**Estate variables as a single source of truth.** `group_vars/all.yml` holds the whole estate's users, keys, and DNS map. Role defaults stay generic and portable; the only environment-specific override is a day-0 bootstrap user in a narrower `group_vars` file. This is where Ansible's variable precedence matters — `group_vars` **replaces**, it doesn't deep-merge, and designing around that instead of fighting it is half of writing maintainable roles.

**Dynamic Proxmox inventory.** The `community.proxmox` inventory plugin discovers the fleet, filters to hosts carrying an `ansible-managed` tag, and composes each host's `ansible_host` from the QEMU guest-agent's reported IP. Add the tag in Terraform, and the node manages itself into the inventory. No static hosts file to maintain.

## Idempotent ≠ effective

The lesson I keep coming back to on this project: a play reporting `changed=0` is not proof the system is in the desired state. It's proof the play didn't *do* anything — which could mean "already correct" or "quietly wrong." The DNS component is signed off on two conditions, not one: idempotent (a second run changes nothing) **and** functionally verified (`resolvectl` shows the interface actually using the intended resolver, with the public fallback resolvers evicted). Green is a claim; the functional check is the evidence.

## What it demonstrates

Agentless config management; idempotency done right (and the idempotent-≠-effective distinction); roles and collections; inventories with real `group_vars` precedence discipline; facts and Jinja templating; dynamic inventory against a live hypervisor; born-reachable day-0→day-2 provisioning; and the full netplan → networkd → systemd-resolved stack on modern Ubuntu. Still on the roadmap: Molecule + ansible-lint for role testing, an audit-first hardening component, and an Ansible Automation Platform layer (execution environments, job templates, workflows, RBAC).

Session notes: [Ansible Standard-Config Refresher — Weekend Reps](/blog/session-ansible-standard-config-refresher)
