# AIBRY Command initial issue set

This bounded issue set serves the Day 2 frozen-schema work and the smallest
vertical slice that exercises it. It does not add the later work hierarchy or
operational screens.

1. Record the evidence-based React/Vite + Express + TypeScript + PostgreSQL
   architecture and the unconnected AIBRY ID OIDC authorization seam.
2. Add versioned `Project` and `Outcome` SQL tables with only the fields needed
   for portfolio inventory and outcome activation.
3. Add representative, non-secret, seed-only AIBRY and AIBRY Labs projects
   covering the five contract classifications.
4. Implement a repository interface and in-memory test repository plus a
   parameterized `pg` repository.
5. Implement `GET /api/portfolio` through the repository interface.
6. Implement authorized `POST /api/outcomes/:id/activate` with a server-side
   maximum of three active outcomes and PostgreSQL concurrency protection.
7. Add a minimal Portfolio UI that reads the API, identifies seed data, and
   presents activation state without offering unsafe clear or destructive
   controls.
8. Add focused unit and HTTP integration tests for authorization, activation,
   success, and fourth-outcome rejection.

Explicitly deferred: live inventory import, AIBRY ID connection, actions,
milestones, blockers, approvals, evidence, reviews, money, dashboards,
integrations, deployment, and production database mutation.
