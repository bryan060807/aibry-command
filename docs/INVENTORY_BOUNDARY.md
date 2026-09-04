# Day 10 Inventory Boundary and Review Contract

**Status:** BOUNDED IMPLEMENTATION VERIFIED WITH REAL IMPORT GATE OPEN
**Reviewed:** September 3, 2026
**Milestone:** Day 10 — Portfolio inventory and policy engine
**Deadline:** September 12, 2026

## Purpose

Day 10 must import a reviewed representation of the real AIBRY/AIBRY Labs portfolio without turning AIBRY Command into a second Garage Admin, a cross-host crawler, or a generalized dependency graph.

The filesystem scanner is a bounded discovery aid. It is not the source of truth for live runtime state, deployment health, or canonical project identity.

## Authority Boundary

### AIBRY Command owns

- canonical portfolio records
- strategic classification
- project lifecycle/work status
- outcomes, milestones, actions, blockers
- approval requests and decisions
- verification evidence attached to completion
- simple cost/revenue/opportunity facts
- portfolio-level review/history

### Garage Admin remains authoritative for

- current runtime/service inventory
- health and logs
- PM2/systemd/service operations
- Windows/Fedora host ownership
- ports, containers, infrastructure topology
- guarded restarts and repairs
- Cloudflare/nginx/control-plane operations
- current operational memory and runtime evidence

AIBRY Command may retain safe links/provenance to those systems. It must not reimplement their operational control plane.

## Discovery Roots

Approved Windows discovery root:

- `C:\Users\bryan\aibry\projects`

`C:\AIBRY` is **not** an unrestricted recursive scan root. Day 10 may discover immediate child names there only to identify possible first-party applications missing from the main projects directory. Bounded metadata inspection of any individual child requires explicit inclusion in the reviewed manifest/specification.

Approved examples for manual review only:

- `C:\AIBRY\aibry-pc-organizer`
- `C:\AIBRY\cam-wall`
- `C:\AIBRY\3d-garage`

These `C:\AIBRY` entries are name-level exception evidence only. They are not
approved recursive scan roots. A specific child must be explicitly selected
before any bounded metadata inspection occurs.

Excluded data boundaries:

- `C:\AIBRY\music-vault`
- `C:\AIBRY\Shared_Folder`

## Non-Windows Sources

The scanner must remain Windows-bounded. Fedora or other non-Windows sources may be represented only as manually reviewed provenance records in the approved manifest.

Known examples include:

- AIBRY ID primary repository: `/home/aibry/projects/AIBRY-Auth`
- AIBRY Website API repository: `/home/aibry/projects/aibry-website-api`
- LyricSync Fedora UI/API runtime sources

Adding manual provenance must not create a cross-host scanner, SSH crawler, runtime discovery subsystem, or Garage Admin replacement.

## Candidate Metadata

Discovery may retain only bounded metadata such as:

- candidate key
- approved source root
- source path or safe source identifier
- project/package name
- Git presence
- branch
- sanitized remote URL
- latest local commit date
- recognizable framework/runtime
- limited README/package description
- presence of deployment configuration
- presence of tests
- duplicate signals

Unknown facts must remain `UNKNOWN`.

Monthly cost remains `null` until independently verified.

## Proposed Manifest Shape

`docs/day10-canonical-manifest.proposed.json` is a deterministic review
artifact, not a database export and not an approval record. It contains:

- `manifestVersion`, `generatedAt`, and `reviewedAt`
- the approved discovery root and explicit exclusions
- exactly the reviewed canonical project groups
- zero or more bounded source/component records per canonical project
- unresolved candidates retained for later human review
- `UNKNOWN` for unsupported facts and `null` for unverified monetary values
- `reviewState: "PENDING"` on review records; this is a review gate, not a
  claim that Bryan has approved the artifact
- an empty `outcomes` array

The manifest uses the existing server spellings where a value is known:
`AIBRY`, `AIBRY_LABS`, `FLAGSHIP`, `REVENUE`, `SUPPORTING`, `MAINTENANCE`,
`FROZEN`, `ACTIVE`, `ARCHIVED`, and `UNKNOWN` for review-only values that the
current import schema cannot yet accept. Import must reject unresolved values
until Bryan explicitly reviews them; this document does not change the
existing application schema.

Source records are provenance, not a dependency graph. Each record identifies
its source role, host, safe path or identifier, discovery mode, bounded
metadata, duplicate signals, and observed timestamp. Fedora records are
manually reviewed identifiers and do not authorize scanning, SSH, or runtime
access.

## Prohibited Discovery Content

The scanner/import manifest must not contain:

- source-code contents
- `.env*` files
- credentials, tokens, keys, passwords, provider secrets, OAuth state, registry credentials
- dependency contents (`node_modules`, vendored dependencies)
- build/cache output
- backup/dump contents
- binary/media contents
- Garage Admin memory/session archives
- personal/shared-folder contents
- Family Tree genealogy/person records
- Hopewell customer/order/payment data
- AIBRY ID account/invite/session data
- camera captures or sensitive camera configuration
- Music Vault media/content
- `.git` object contents

Repository URLs must be sanitized to remove credentials, userinfo, query strings, and fragments before persistence.

## Path Safety

The scanner must:

- canonicalize/resolve a candidate path before accepting it
- enforce containment inside the specifically approved root/path after resolution
- refuse junction/symlink/reparse-point traversal that escapes the approved boundary
- treat Windows paths case-insensitively for duplicate detection
- never execute package scripts, project binaries, Git hooks, or discovered code while scanning

## Approval Model

Discovery cannot automatically:

- classify
- activate
- merge
- import
- persist a canonical project
- delete
- archive
- approve itself

Candidate review state must distinguish at least:

- `PENDING`
- `APPROVED`
- `REJECTED`

A scanner-created candidate always starts `PENDING`.

If implementation retains separate inclusion/classification/import approval fields, each must preserve pending vs rejected semantics rather than using a boolean where `false` could mean either state.

## Canonical Project vs Source/Component

Portfolio rows represent canonical products, platforms, initiatives, or operating systems—not every repository directory.

One canonical project may have multiple provenance/source records.

A minimal source relation may retain:

- project id
- source type
- host
- source key/path/identifier
- source role
- observed timestamp
- manifest/hash provenance

The Day 10 implementation adds the smallest future extension: a single
`project_sources` relation keyed to `projects`, with a source key, bounded
metadata, source role/type, host, safe path/identifier, observed timestamp,
review state, and manifest/hash provenance. It is provenance only; it is not a
dependency graph or runtime inventory.

Useful source roles may include:

- `PRIMARY_REPO`
- `UI_REPO`
- `API_REPO`
- `BRIDGE`
- `LEGACY`
- `RUNTIME`
- `DATA_DEPENDENCY`
- `REFERENCE`
- `SUPPORT`

This is provenance only. Day 10 must not build a generalized dependency graph.

## Reviewed Canonical Groupings

### Keep as separate canonical projects

- ASOS Kernel
- AIBRY Command
- Catalog OS
- AIBRY Website
- TrackMaster
- ChordMaster
- Garage Assist
- Garage Admin / OTIS
- TaskMaster
- AIBRY Vision
- App Autopsy
- AIBRY ID
- Hopewell Winery Platform
- LyricSync
- MasterAudioBook
- Silverado Oil Leak Atlas
- Family Tree

Catalog OS remains a separate applied ASOS system; it must not be merged into ASOS Kernel.

### Component/source relationships

- `aibry-specialist-platform` — ASOS Kernel primary source; Catalog OS remains separate
- `garage-admin-otis` — current canonical Garage Admin implementation
- `garage-admin-v2` — Garage Admin predecessor/legacy source
- `aibry-worker-agent` — Garage Admin evidence/runtime component
- `3d-garage` — Garage Admin/OTIS design/prototype reference source
- `GarageAssistBridge` — Garage Assist component
- `vision-privacy` — AIBRY Vision support/privacy component unless later evidence proves otherwise
- `TrackMaster-Comparator` — TrackMaster companion/legacy tooling
- `aibry-chordmaster-api` and `aibry-chordmaster-ui` — ChordMaster API and UI sources
- `HoldTheSalt` — Hopewell Winery Platform primary source
- `aibry-music-vault-api` — legacy Catalog OS/Music Vault component requiring separate future security/retirement review
- `libs` — shared code/component directory; exclude as a canonical portfolio project

### Recognizable but requiring explicit portfolio-model decision

- `showcase` — OpenAI Showcase — Garage Admin initiative. Its portfolio-model classification and lifecycle status require explicit approval; do not label it paused or infer a canonical product from the name alone.

The following are retained outside the canonical list until an explicit
portfolio-model decision:

- `TradeBrain`
- `aibry-masterclass-landing` / AIBRY Masterclass
- `showcase` / OpenAI Showcase — Garage Admin

These review-queue entries retain source provenance but are not canonical
projects until Bryan makes an explicit portfolio-model decision. They receive
no Outcomes and are not auto-imported.

### Remain UNKNOWN pending review

- `event_horizon`
- `lode-ai`
- `C:\AIBRY\aibry-pc-organizer`
- `C:\AIBRY\cam-wall`

Unknown candidates must retain provenance without merging, activation, or guessed purpose/classification/status.

## Classification, Project Status, and Runtime State

These are separate facts.

### Classification

Represents strategic portfolio role, for example flagship, supporting, or commercial/revenue-oriented.

If the existing `REVENUE` classification is retained, it means intended/plausible commercial role only. It must never imply verified customers, recurring revenue, or dollar revenue. Actual financial facts remain unknown/null until observed.

### Project status

Represents current work/lifecycle posture. It must not be used as a proxy for deployment health.

Examples from the reviewed environment:

- GarageAssist can have a healthy running service while its hardware-validation workstream is paused.
- Masterclass can have a running runtime while product work is frozen/paused.
- LyricSync can be deployed while current development is maintenance/completed.
- Family Tree can be actively developed and publicly deployed simultaneously.

### Runtime/deployment state

Remains live operational evidence from Garage Admin or another authoritative runtime source. Day 10 must not derive it from repository age or project status.

### Frozen-project action compatibility

The existing policy that frozen projects cannot generate active actions is
appropriate for ordinary planned work, but it must not block an explicitly
approved security or incident-response action against a deployed frozen
project. The smallest compatible correction is a narrowly typed,
approval-gated exception with evidence requirements; do not redesign the
general lifecycle model or treat the exception as runtime-health state.

## Reviewed Classification Corrections

The final manifest should incorporate the following reviewed direction before Bryan approval:

- ASOS Kernel — FLAGSHIP / ACTIVE
- AIBRY Command — SUPPORTING / ACTIVE
- Catalog OS — SUPPORTING / ACTIVE
- Garage Admin / OTIS — SUPPORTING / ACTIVE
- AIBRY Vision — SUPPORTING / ACTIVE
- App Autopsy — currently ACTIVE
- Family Tree — currently ACTIVE
- GarageAssist — commercial/revenue role may remain, but current workstream is paused while runtime state is tracked separately
- AIBRY Masterclass — remains unresolved; do not use `FROZEN` to imply runtime shutdown if it is later retained. Runtime and work status are separate
- PC Organizer — UNKNOWN / UNKNOWN pending evidence
- Camera Wall — UNKNOWN / UNKNOWN pending evidence
- Music Vault API — remove as a standalone canonical project; retain as legacy component/review item
- Worker Agent — remove as a standalone canonical project; retain as Garage Admin component
- 3D Garage — remove as standalone canonical project; retain as OTIS reference/prototype source

Any classification not explicitly reviewed remains pending Bryan approval in the final manifest.

## Manifest Integrity

The reviewed manifest must become an exact immutable artifact before import.

The planning artifact is `docs/day10-canonical-manifest.proposed.json`. It is a
review proposal only: it is not an import instruction, database record, or
approval. Its SHA-256 is reported outside the artifact for review so the file
does not contain a self-referential hash. All project, source, and import
approval states in the proposal remain `PENDING`.

Required behavior:

1. produce a sanitized reviewed manifest
2. compute the SHA-256 of the exact artifact bytes outside the artifact itself
3. obtain Bryan's explicit approval of that exact artifact/hash (recorded in
   `CURRENT_STATE.md`, not inside the immutable artifact)
4. re-hash the exact import payload immediately before import
5. refuse import if the artifact/hash differs
6. retain manifest/source provenance on imported records

The approved artifact remains a proposal with `PENDING` record review states.
The bounded import service requires an external `APPROVED` decision and an
exact matching hash; the approved real artifact has not been imported.

The proposal contains zero Outcomes. Discovery and import must never create or
activate an Outcome automatically.

## Import Requirements

- Import is transactional.
- Failure leaves no partial project/source records.
- Re-import/idempotency behavior must be explicit and tested.
- The approved manifest hash is rechecked immediately before import.
- A hash mismatch refuses import.
- Existing seeded AIBRY Command data must be matched rather than duplicated.
- No imported project receives an active Outcome automatically.
- Duplicate signals are evidence only and never trigger automatic merging.
- Only explicitly approved canonical groupings are consolidated.

## Three-Outcome Policy Verification

Day 10 must preserve the existing server-enforced maximum-three-active-outcomes rule.

Acceptance requires:

- three activations allowed
- fourth activation rejected server-side
- concurrent activation cannot exceed three
- concurrency behavior proven against an isolated real PostgreSQL test instance using separate connections/transactions

This test must not use or mutate the live Fedora production database.

## Status Compatibility Note

The existing Project schema uses `ACTIVE`, `MAINTENANCE`, `FROZEN`, and
`ARCHIVED` for project work/lifecycle status. That field must not be treated as
runtime health. In particular, a deployed product may have paused or frozen
work while still requiring an authorized security or incident action. Before a
future implementation enforces the Product Contract rule that frozen projects
cannot generate active actions, the smallest compatible correction is to keep
runtime state separate and provide an explicitly authorized security/incident
path that is not inferred from runtime health. This is a Day 10 design note;
no lifecycle or action-policy implementation is part of this review.

## Day 10 Acceptance Requirements

Day 10 implementation is complete only when all of the following are proven:

- scanning remains inside approved paths after canonical resolution
- canonical/resolved path containment rejects junction, symlink, and Windows
  reparse-point escapes
- case-insensitive Windows path duplicates are detected
- exclusions are enforced
- secret/personal/media/data boundaries are not admitted
- Git remote userinfo, credentials, query strings, and fragments are removed or
  refused before persistence
- unknown information remains UNKNOWN
- scanner cannot self-approve
- duplicate signals do not auto-merge
- manually reviewed/Fedora provenance can be represented without cross-host scanning
- multiple sources can belong to one canonical project
- only approved canonical groupings are consolidated
- no imported project receives an Outcome
- approved manifest/hash provenance is retained
- hash mismatch refuses import
- re-import/idempotency behavior is defined
- failed import leaves no partial records
- three active outcomes are allowed
- a fourth is rejected server-side
- concurrency cannot exceed three
- concurrency is proven with separate connections/transactions against an
  isolated real PostgreSQL test database, never the live Fedora database
- existing Day 5 behavior/tests remain passing
- typecheck passes
- all tests pass
- production build passes
- `CURRENT_STATE.md` records evidence and one exact next action
- no production/external system is touched

## Separate Future Review — Not Day 10 Scope

`aibry-music-vault-api` exposes generic Vault mutation operations and predates the current Catalog OS governance path of exact proposal -> human authorization -> bounded apply -> independent verification. It requires a separate future audit/retirement decision.

Day 10 must not modify, stop, retire, expose, or otherwise operate that service.

## Current Authorization State

**Bounded Day 10 implementation is authorized and verified. Import of the
approved real manifest is not authorized in this task.**

The next gate is separate Bryan/Garage Admin authorization to import the exact
approved artifact after reviewing implementation evidence.
