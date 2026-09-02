# AIBRY Command

AIBRY Command is the private operating control plane for AIBRY, AIBRY Labs, and the systems supporting them. It is powered by ASOS Kernel principles: explicit roles, evidence, approval boundaries, independent verification, and replayable decisions.

## Repository operating documents

Keep these files at the repository root:

- `AGENTS.md` - binding Codex and sub-agent instructions
- `PRODUCT_CONTRACT.md` - frozen MVP scope and design
- `MILESTONES.md` - deadlines and momentum policies
- `CURRENT_STATE.md` - live status, evidence, blockers, and next action
- `PARKING_LOT.md` - quarantined ideas
- `README.md` - human setup and startup instructions

Codex automatically discovers `AGENTS.md`. That file requires Codex to read the remaining operating documents at the beginning of each session.

## First setup

1. Create the project directory.
2. Copy all six files into its root.
3. Open a terminal in that directory.
4. Initialize Git if this is a new repository.
5. Start Codex from the repository root.
6. Paste the startup prompt below.

Example on Windows:

```powershell
cd C:\Users\bryan\aibry\projects\aibry-command
git init
codex
```

Do not commit automatically unless Bryan requests it.

## First Codex startup prompt

```text
You are the lead implementation agent for AIBRY Command.

First read AGENTS.md, PRODUCT_CONTRACT.md, MILESTONES.md,
CURRENT_STATE.md, and PARKING_LOT.md completely. Inspect the repository,
current git state, and available local technical context before proposing work.

Identify the current milestone, nearest unmet acceptance criterion, and smallest
complete vertical slice that advances it. State those three items.

Use sub-agents for bounded independent work. At minimum, use a Scope Sentinel
before substantial implementation and an independent Tester before declaring
the slice complete. Use Builder and Reviewer agents when ownership can be
clearly separated. Never give active agents overlapping file ownership.

Do not add features outside the frozen MVP. Record adjacent ideas in
PARKING_LOT.md without implementing them. Do not change architecture, create a
different repository, add paid services, deploy, delete, migrate production,
alter credentials, or communicate externally without explicit approval.

For this first session, remain read-only until you have inspected the repository
and presented:

1. The current milestone and deadline.
2. The nearest unmet acceptance criterion.
3. Your recommended technical architecture based on actual evidence.
4. A file-level implementation plan for the smallest vertical slice.
5. Scope Sentinel findings.
6. Any decisions that require Bryan.

Do not implement until Bryan approves that plan.
```

## Normal Codex build prompt

```text
Continue AIBRY Command from the repository's recorded state.

Read every required operating document and inspect git changes first. Identify
the current milestone, nearest unmet acceptance criterion, and smallest complete
vertical slice.

Follow AGENTS.md, including bounded sub-agent delegation, non-overlapping file
ownership, independent testing, scope review, and reserved approvals. Implement
only the approved slice. Verify it, record evidence in CURRENT_STATE.md, update
the exact next action, and stop when the acceptance criterion is satisfied.
```

## Governing principle

**Make completion easier than reinvention.**

