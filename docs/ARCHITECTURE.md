# AIBRY Command architecture

## Decision

AIBRY Command uses one TypeScript web application with a React/Vite client and
an Express server. The server owns the policy boundary and persistence adapter.
PostgreSQL is the production relational store, accessed through the existing
`pg` pattern and version-controlled SQL migrations. The runtime is compatible
with PM2 on Windows; PostgreSQL remains Fedora-owned infrastructure.

This is based on repository evidence from Garage Admin V2: React/Vite,
Express, `pg`, SQL schema, and PM2-compatible runtime patterns. No existing
AIBRY Command application architecture was present to preserve.

## Current slice boundaries

The first slice contains only `Project` and `Outcome`, portfolio read/list, and
server-side outcome activation. The default local repository is in memory so
tests and local UI work do not require `DATABASE_URL` or a live database. The
production adapter is `server/portfolio/pg-repository.ts`.

When the `dev` script sets `AIBRY_COMMAND_LOCAL_PREVIEW=true`, the server runs
without `DATABASE_URL` as an explicit seed-only local preview bound to
`127.0.0.1` and permits the preview UI to read the seeded records. Any other
mode keeps authorization fail-closed; production also refuses to start without
`DATABASE_URL`. No database or authentication connection is made by this
slice.

The PostgreSQL activation transaction takes a transaction-scoped advisory lock
before counting active outcomes and changing the target outcome. This
serializes concurrent activation attempts across application instances without
introducing a new infrastructure component.

## Authorization seam

AIBRY ID using the established TrackMaster OIDC pattern is the approved future
authorization boundary. This repository deliberately does not add an OIDC
package, connect to AIBRY ID, or modify AIBRY ID. `server/auth/authorization.ts`
defines the injectable decision seam. The default decision is deny, so a
production request cannot become authorized accidentally. Tests inject an
explicit allow decision.

## Logging and audit design

`server/logging.ts` emits bounded JSON records containing an event name and
small allow-listed fields. It never records headers, request bodies, tokens,
passwords, connection strings, or credentials.

Important mutations will use an append-only audit-event design in a later
slice. No audit table is added to this migration because the approved slice
contains only the Project and Outcome tables needed for portfolio policy.

## Deferred

Actions, milestones, blockers, approvals, evidence, reviews, money, export,
backup, real inventory import, and live authentication remain outside this
slice and require their documented milestone and approvals.
