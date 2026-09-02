# AIBRY Command - Product Contract

**Owner:** Bryan Miller / AIBRY Labs  
**Flagship platform:** ASOS Kernel  
**MVP deadline:** October 14, 2026

## Purpose

AIBRY Command is Bryan's private operating control plane for creative work, software products, infrastructure, publishing, and revenue activity.

It is a thin decision-and-execution layer above existing systems. It does not replace GitHub, monitoring, accounting, file storage, or every tool already in use.

Its purpose is to reduce dependence on memory, mood, motivation, and heroic recovery sessions.

## Operating structure

| Engine | Role | Outputs |
| --- | --- | --- |
| AIBRY | Creative IP and audience | Music, books, visual media, merchandise |
| AIBRY Labs | Products and technical revenue | ASOS, TrackMaster, ChordMaster, Garage Assist, automation services |
| AIBRY Command | Internal operating system | Priorities, execution, approvals, evidence, review |

AIBRY Command dogfoods ASOS Kernel. Internal workflows should become credible evidence that ASOS coordinates real work across domains.

## Five core questions

The MVP succeeds only if it answers:

1. What are the three active outcomes?
2. What is the next concrete action for each?
3. What is blocked or overdue?
4. What requires Bryan's approval?
5. What evidence proves completed work is complete?

## Included in MVP

- Portfolio inventory
- Classification: Flagship, Revenue, Supporting, Maintenance, Frozen
- Maximum three active outcomes
- Project health and current milestone
- One required next action per active outcome
- Action owner, deadline, status, blocker, and effort ceiling
- Approval queue
- Evidence attached to completion claims
- Weekly CEO review
- Simple revenue, expense, opportunity, and product-cost fields
- Activity and decision history
- Parking lot with idea quarantine
- Export and backup
- Responsive desktop-first interface

## Excluded from MVP

- Custom chat interface
- Autonomous production execution
- Native mobile application
- Full accounting system
- CRM replacement
- Custom identity provider
- New agent framework
- Plugin marketplace
- Complex third-party integrations
- Elaborate predictive analytics
- Gamification
- Visual redesign after wireframe lock

If a feature does not improve one of the five core questions, it waits.

## Navigation and screens

1. **Today:** three active outcomes, next actions, approvals, blockers, deadlines, milestone, money pulse
2. **Portfolio:** all projects, classification, status, purpose, cost, and links
3. **Work:** outcomes, milestones, actions, blockers, and dependencies
4. **Approvals:** reversible/irreversible decisions, risk, cost, evidence, and decision
5. **Evidence:** tests, screenshots, logs, artifacts, URLs, and acceptance results
6. **Money:** simple revenue, expenses, opportunities, and operating costs
7. **Reviews:** weekly CEO reviews, Completion Mode, and recovery events
8. **Parking Lot:** quarantined ideas and future work
9. **System:** export, backup, policy, links, and audit history

## Work hierarchy

`Project -> Outcome -> Milestone -> Action -> Evidence`

Every active action must fit within one working day. Larger work must be split before entering `In Progress`.

## Core entities

| Entity | Essential fields |
| --- | --- |
| Project | id, name, engine, classification, status, purpose, links, monthly_cost |
| Outcome | id, project_id, title, success_measure, deadline, status, priority |
| Milestone | id, outcome_id, title, due_at, acceptance_criteria, status |
| Action | id, milestone_id, title, owner, status, due_at, effort_limit, blocker_id |
| Blocker | id, action_id, description, owner, opened_at, resolution |
| Approval | id, subject, risk_level, reversible, cost, status, requested_at, decided_at |
| Evidence | id, action_id, type, location, summary, verification_result, created_at |
| Decision | id, context, options, choice, rationale, decided_at |
| MoneyRecord | id, project_id, type, amount, date, status, note |
| Idea | id, title, source, captured_at, review_after, status, promoted_to |
| Review | id, week_of, capacity, commitments, outcomes, scope_status, signed_at |
| AuditEvent | id, actor, action, entity_type, entity_id, timestamp, metadata |

## State policies

- Do not activate an outcome if three are already active.
- Do not start an action without an owner and acceptance criteria.
- Do not verify an action without evidence.
- Frozen projects cannot generate active actions.
- High-risk approvals require Bryan.
- Adding an MVP feature requires removing one of equal or greater effort.

## Technical principles

Codex must inspect the repository before choosing frameworks or adding infrastructure.

The MVP requires:

- One deployable web application
- Server-enforced authorization
- Relational persistent storage
- Version-controlled migrations
- Append-only audit events for important mutations
- Structured logs
- Automated backup/export
- Seed data representing real AIBRY portfolio categories without secrets
- Unit tests for state and policy rules
- Integration tests for the critical path
- End-to-end coverage for the weekly review

Use links and lightweight adapters before deep integrations. Existing services remain systems of record until evidence justifies more.

## Visual direction

- Serious dark operations console, not novelty hacker theater
- Dark neutral foundation
- Cold blue for information
- Amber for waiting and approval
- Red only for real risk, overdue work, or failure
- Green only for verified completion
- Strong typography, compact cards, minimal animation
- Plain language over management jargon
- Reward verified closure, not task creation or performative busyness

## MVP success measures

- Production deployment by October 14, 2026
- Three or fewer active outcomes
- Every active outcome has a visible next action
- Every completed critical action has verification evidence
- Weekly review completes within 20 minutes
- Portfolio contains all active AIBRY and AIBRY Labs projects
- Backup/export recovery is tested
- At least one real project reaches verified completion through AIBRY Command

## Failure indicators

- Maintenance consumes more than one hour per week after stabilization
- The product duplicates whole external systems
- More work is created than completed
- Bryan must remember unrecorded state to operate it
- Agents can approve their own risky work
- Missed deadlines expand the schedule instead of reducing scope

## Final principle

**AIBRY Command is successful when it makes completion easier than reinvention.**

