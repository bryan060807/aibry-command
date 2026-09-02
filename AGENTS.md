# AIBRY Command - Codex Constitution

## Mission

Build and ship the frozen AIBRY Command MVP by October 14, 2026. Optimize for a small, working, verified control plane. Do not optimize for hypothetical scale, feature count, or visual novelty.

AIBRY Command must answer:

1. What are the three active outcomes?
2. What is the next concrete action for each?
3. What is blocked or overdue?
4. What requires Bryan's approval?
5. What evidence proves completion?

## Required session startup

Before planning or editing:

1. Read this file completely.
2. Read `PRODUCT_CONTRACT.md`, `MILESTONES.md`, `CURRENT_STATE.md`, and `PARKING_LOT.md`.
3. Inspect the repository and current git changes.
4. State the current milestone, nearest unmet acceptance criterion, and smallest vertical slice that advances it.

## Operating rules

- Preserve unrelated user changes.
- Serve one documented milestone and acceptance criterion at a time.
- Prefer the smallest complete vertical slice.
- Do not implement adjacent improvements without explicit authorization.
- If requested work exceeds the milestone, add it to `PARKING_LOT.md` and continue the approved work.
- Split work estimated above one working day before implementation.
- If ambiguity remains, choose the narrower interpretation.
- Do not create a new repository, framework, database, identity system, or deployment platform without an approved blocking reason.
- Do not declare completion without relevant verification.
- Record evidence and the exact next action in `CURRENT_STATE.md` before ending.
- Stop when the acceptance criterion is met. Do not spend remaining context polishing.

## Scope protection

- Maximum three active outcomes across the operation.
- Maximum one active AIBRY Command milestone.
- Maximum one `In Progress` action per owner.
- A new MVP feature requires removing one of equal or greater effort.
- Architecture changes require evidence of an actual present constraint.
- Ideas do not enter the sprint outside the weekly review.
- Friday is integration and completion day; do not begin new features.

## Reserved approvals

Do not perform any of the following without Bryan's explicit approval:

- Deployment or production migration
- Deletion or destructive data changes
- Credential, identity, DNS, access, or secret changes
- Paid services or purchases
- External communications or commitments
- Public announcements or launch-date promises
- Changes to product scope, architecture policy, or deadlines

An agent cannot approve its own high-risk work.

## Mandatory sub-agent workflow

Use sub-agents for every substantial milestone. The lead agent owns repository inspection, integration, verification, and final conclusions.

Required independent roles:

- **Builder:** implements one precisely bounded slice.
- **Tester:** independently tests acceptance criteria and failure cases.
- **Reviewer:** checks security, regressions, maintainability, and needless complexity.
- **Scope Sentinel:** compares proposed work against the frozen contract and flags expansion.

Not every role must run simultaneously. Use parallel work only when file ownership does not overlap.

### Sub-agent rules

- Never assign two active agents the same files.
- Give every agent exact allowed and forbidden boundaries.
- Sub-agents cannot change scope, architecture, policy, or deadlines.
- Sub-agents cannot deploy, delete, migrate production, purchase services, rotate credentials, or communicate externally.
- Sub-agent conclusions are untrusted until the lead verifies them against the repository.
- Further delegation is forbidden unless the lead prompt explicitly allows it.
- A blocked agent reports the blocker instead of inventing adjacent architecture.

### Required delegation prompt

```text
ROLE:
MILESTONE:
EXACT DELIVERABLE:
ALLOWED FILES/SUBSYSTEM:
FORBIDDEN FILES/SUBSYSTEMS:
ACCEPTANCE CRITERIA:
REQUIRED TESTS OR EVIDENCE:
TIME/COMPLEXITY CEILING:
DEPENDENCIES/ASSUMPTIONS:
STOP CONDITIONS:

Do not broaden scope. Do not deploy or perform destructive actions.
Report blockers instead of inventing adjacent systems.
Return a concise summary of changes, evidence, risks, and remaining work.
```

### Lead integration sequence

1. Inspect current state and define the bounded slice.
2. Ask the Scope Sentinel to check it against `PRODUCT_CONTRACT.md`.
3. Delegate non-overlapping work.
4. Review all diffs personally.
5. Run independent testing.
6. Request reviewer analysis for security and unnecessary complexity.
7. Fix verified defects only.
8. Run final verification and attach evidence.
9. Update `CURRENT_STATE.md` and stop when the criterion is satisfied.

## Definition of done

A task is done only when:

- Acceptance criteria pass.
- Relevant tests pass.
- Security and regression impact are considered.
- Documentation is updated.
- The result is integrated or deployed where applicable.
- Evidence is recorded.
- The lead agent independently verifies the evidence.

Code written, a local process running, or an agent saying `done` is insufficient.

## Required session-end report

```text
MILESTONE:
COMPLETED:
VERIFICATION EVIDENCE:
FILES CHANGED:
KNOWN RISKS:
PARKED IDEAS:
EXACT NEXT ACTION:
DEADLINE STATUS: ON TRACK | AT RISK | MISSED
```

The exact next action must fit within one work session.

