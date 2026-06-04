---
description: Create a decision-complete implementation plan. For example, '/plan implementing ...'
argument-hint: "[task]"
---
Plan $ARGUMENTS

## PHASE 1 - Ground in the environment (explore first, ask second)

Begin by grounding yourself in the actual environment. Eliminate unknowns in the prompt by discovering facts, not by asking. Resolve all questions that can be answered through exploration or inspection. Identify missing or ambiguous details only if they cannot be derived from the environment. Silent exploration between turns is allowed and encouraged.

Before asking any question, perform at least one targeted non-mutating exploration pass (for example: search relevant files, inspect likely entrypoints/configs, confirm current implementation shape), unless no local environment/repo is available.

Exception: you may ask clarifying questions about the prompt before exploring, ONLY if there are obvious ambiguities or contradictions in the prompt itself. However, if ambiguity might be resolved by exploring, always prefer exploring first.

Do not ask questions that can be answered from the repo or system (for example, "where is this struct?" or "which UI component should we use?" when exploration can make it clear). Only ask once you have exhausted reasonable non-mutating exploration.

## PHASE 2 - Intent chat (what we actually want)

* Interview me relentlessly about every aspect of this plan until we reach a shared understanding. 
* Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. 

## PHASE 3 — Implementation chat (what/how we’ll build)

* Once intent is stable, keep asking until the spec is decision complete: approach, interfaces (APIs/schemas/I/O), data flow, edge cases/failure modes, acceptance criteria, rollout/monitoring, and any migrations/compat constraints.

## Asking questions

Critical rules:

* Offer only meaningful multiple‑choice options; don’t include filler choices that are obviously wrong or irrelevant.
* Strongly prefer using the `ask-question` tool to ask any questions.
* Every `ask-question` call must mark exactly one option as recommended (`isRecommended: true`).

You SHOULD ask many questions, but each question must:

* materially change the spec/plan, OR
* confirm/lock an assumption, OR
* choose between meaningful tradeoffs.
* not be answerable by non-mutating commands.

Use the `ask-question` tool only for decisions that materially change the plan, for confirming important assumptions, or for information that cannot be discovered via non-mutating exploration.

## Planning posture

Treat the user's proposed approach as a strong starting point, not as automatically final.

Do not derail planning into critique, but leave room to improve the idea when evidence suggests a better path.

During exploration and planning:

* Preserve the user's stated goals and constraints.
* Suggest refinements when they are likely to materially improve simplicity, correctness, maintainability, or fit with the system.
* Treat implementation details in the request as provisional unless clearly stated as requirements.
* Notice assumptions, risks, unnecessary complexity, or mismatch with the existing codebase.
* If the requested approach seems flawed, briefly explain the issue and recommend a better alternative.

Default to moving the plan forward.
Challenge only when the concern is material.

## Finalization rule

Only output the final plan when it is decision complete and leaves no decisions to the implementer.

Choose a short kebab-case `<plan_name>` from the request.

When the plan is ready, create `~/.pi/plans/<plan_name>/PLANNING.md` as concise Markdown with:
- Summary
- Findings
- Decisions
- Implementation Steps
- Validation

After writing the file, ask with `ask-question`:
"The plan has been written to `~/.pi/plans/<plan_name>/PLANNING.md`. Is it ready for implementation?"

Invoke `ask-question` with only one explicit option:
- Yes, implement this plan

The tool allows free-form input, so do not add separate options for requesting changes or deferring approval.

If I request changes, investigate or ask more questions as needed, edit `PLANNING.md`, and ask for approval again. Do not start implementation until explicit approval.

