---
title: "Six Ways AI Agents Fail in Production Infrastructure, and the Controls That Catch Them"
description: "A failure taxonomy from instrumenting a multi-agent system against live infrastructure: what each mode looks like, the metric signal that detects it, and the control that contains it. Includes the cost data showing a 57x price difference for identical diagnostic quality, and an honest account of the failure class none of this instrumentation catches."
pubDate: 2026-08-23
category: about
draft: false
---

There is no shortage of writing about getting AI agents to work. There is very little about how they fail, which is the part you need before you let one touch production.

This is a taxonomy from instrumenting a multi-agent system that provisions real infrastructure - Terraform against a live Proxmox host, with a planner agent, a Terraform sub-agent and a validator. Six failure modes, each with a metric signal that detects it and a control that contains it. Then the cost data, because model selection is a control and most teams are choosing by whichever model was in last week's Substack. Then the failure class that none of this instrumentation catches, which is the part I would want to know if I were reading someone else's version of this.

The measurements come from a six-scenario eval suite: two happy paths and four synthetic failures, run across five models.

## The diagnosis loop only runs on failure, which is the first useful finding

The system does not call an LLM on the happy path. Provisioning succeeds, the validator passes, and the run costs nothing. The LLM is invoked only in the DIAGNOSING state, which fires when validation fails.

That means the eval is almost entirely a measurement of failure-diagnosis quality, and it means the happy path has a hard target: zero LLM calls, zero dollars. If a clean run starts costing money, something invoked diagnosis that should not have, and that is a defect regardless of whether the run succeeded.

Designing so the expensive path is the exceptional path is worth doing for cost reasons. It also turns cost into a correctness signal.

## Context degradation

The agent's hypothesis drifts further from the root cause with each retry rather than converging on it. Retry three is worse than retry one.

The signal is input tokens rising across retries within a single scenario. The context accumulates failed attempts, and the model starts reasoning about its own previous wrong answers instead of the original error.

The control is a retry cap, and treating retry count as a quality metric rather than only a cost metric. A scenario that needs three retries is telling you the diagnosis is not converging. On the VM scenarios every model drifted toward cluster-topology speculation instead of the simple answer, which was that the template VMID did not exist.

## Specification drift

The same error produces different proposed fixes depending on which model is answering. Not different wording - different fixes.

The signal is cost variance across model lines on identical scenarios, which is what surfaced it: the models were not doing the same amount of work because they were not solving the same problem.

The control is to pin the model and treat model choice as configuration under change control, not as a runtime detail. If the diagnosis changes when the model changes, then the model is part of your system's specification whether you documented it or not.

## Cascading failure

Multiple independent faults in one deployment. Wrong storage pool and wrong template and wrong bridge. The agent has to enumerate them sequentially, because fixing one only reveals the next.

The signal is high retry counts, two to three per scenario, and scenarios that hit the retry cap without resolving.

The control is to expect partial diagnosis and to never auto-apply. On the hardest scenario only one of five models found both root causes, and it found them on the third retry. An agent that reports one cause confidently when there are three is not lying to you, it is answering the question you asked in the way its context allowed.

## Silent failure

The most expensive mode, and the one conventional testing is worst at.

Silent failure is when the system reports success and did nothing, or reports success and did the wrong thing. No exception, no error status, nothing to page on. In the eval suite this is measured as an invariant on the happy path - zero LLM calls, zero cost - because a violation means diagnosis fired on a run that should never have needed it.

The general control is to assert on absence, not just presence. Most tests check that something happened. Fewer check that the thing which should not have happened did not. I have hit this repeatedly outside the eval harness too, and it is the subject of the honest section further down.

## Sycophantic confirmation

The agent proposes a fix, the apply fails, and it proposes the same fix again with equal confidence. And again... and then compliments you when you agree the fourth time.

The signal is an identical hypothesis appearing repeatedly in the run log across retries.

The control is to feed the apply result back into the diagnosis context and detect repeats explicitly. This one is genuinely dangerous in an operational setting, because confident repetition reads to a human reviewer as consistency. It looks like the agent is sure. It is not sure, it is stuck, and those present identically.

## Tool selection errors

The agent proposes using a provider or tool that is not available in the environment. In the eval suite, a scenario where Terraform requires a Vault provider that was never installed.

The signal is a diff between what the agent proposes and what the tool registry actually contains.

The control is registry enforcement: the system refuses the proposal rather than attempting it and failing at apply time. The distinction matters because a refusal is a clean signal you can count, while an apply failure is an incident you have to interpret.

## Model selection is a control, and the cost data is not what people expect

Five models, same six scenarios, same harness:

| Model | Avg retries | Cost per failure | Notes |
|---|---|---|---|
| claude-haiku-4-5 | 2.0 | $0.0017 | Stable, correct on simple failures |
| gpt-4o-mini | 2.25 | $0.0006 | Cheapest; shallower hypotheses |
| gpt-4o | 1.5 | $0.0187 | Only model to find both root causes on the hardest scenario |
| claude-sonnet-4-6 | 1.25 | $0.0216 | Fewest retries |
| claude-opus-4-6 | 2.25 | $0.099 | Same retry behaviour as Haiku, same wrong hypothesis |

Opus cost _57 times_ what Sonnet did, matched the cheapest model's retry count, and reproduced the identical topology-speculation failure. On this task class, the premium bought nothing measurable.

The finding is not "use the cheap model." It is that the relationship between model cost and task quality is empirical, task-specific, and cheap to measure - and almost nobody measures it. A six-scenario harness and an afternoon produced a defensible answer for one task class. Most organisations are making this decision by reputation.

Haiku is the production diagnosis model here, at a fifth of a cent per failure.

## What none of this catches

This is the part I would want from someone else's version of this document.

The taxonomy above covers failures in what the agent *reasons*. It does not cover failures in the *seams* between the agent's output and the system that consumes it, and in my experience that is now where the majority of real defects live.

Recent examples from hardening a retrieval system, all found in two days, none of which any of the six detectors would have flagged:

A validation check that had been green for months while being structurally incapable of failing. It asserted an HTTP 200 against a surface that returns 200 regardless of outcome, over a write that was idempotent by content hash. Refusal, silent no-op and success were indistinguishable. It was not a weak test, it was a green light wired to nothing.

A guard that failed open. Asked to enforce a similarity threshold it could not read from an older server, it concluded that nothing was similar and allowed the write. A gate that cannot evaluate its own rule has to block, not pass, and this is a design default worth stating explicitly because the lazy implementation always fails the other way.

A human-approval airlock for irreversible deletions, fully built and reviewed and merged, whose delete path had never executed once. The first real execution failed three ways, starting with a foreign key that made the deletion it existed to authorise impossible. Deployed and exercised are different claims.

Authorization that was never wired to authentication. Identity resolution worked correctly. Nothing ever used the correctly-resolved identity to decide whether the caller was allowed to touch the row.

The pattern across all four is that unit tests passed. One hundred and eighty-one of them, green, throughout. They were green because each component was correct in isolation and the defects lived between components. More unit tests would have caught none of it, not because the request wasn't made.  The unit tests wouldn't have caught it because the post-wiring testing did not reveal the weakness.

What caught them was running the thing end to end, once, for real - and in two cases, deliberately trying to make a passing test fail to confirm it could.

## Two rules that generalise

Wired is not exercised. Before accepting that a capability is done, require the output of one real end-to-end run as the receipt. Not the observation that a caller exists, not a passing unit test. A rolled-back transaction or an intercepted write is fine and usually better - what is not fine is that nobody has ever run it.

A test that cannot fail is not coverage. When a test is offered as evidence, ask what result would turn it red. If nothing realistic would, it is decoration with a green checkmark, and it is worse than no test because it consumed the attention that a real one would have had.

Neither of these is about AI specifically. Both got significantly more expensive to ignore once a system started generating its own plausible-looking code and its own plausible-looking tests to go with it.
