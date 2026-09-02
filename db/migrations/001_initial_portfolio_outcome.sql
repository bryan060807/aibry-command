-- AIBRY Command MVP: the smallest relational boundary for Portfolio/Outcome.
-- Apply only through the approved Fedora-owned migration process.

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  engine TEXT NOT NULL CHECK (engine IN ('AIBRY', 'AIBRY_LABS')),
  classification TEXT NOT NULL CHECK (
    classification IN ('FLAGSHIP', 'REVENUE', 'SUPPORTING', 'MAINTENANCE', 'FROZEN')
  ),
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'MAINTENANCE', 'FROZEN', 'ARCHIVED')),
  purpose TEXT NOT NULL CHECK (char_length(purpose) BETWEEN 1 AND 1000),
  links JSONB NOT NULL DEFAULT '[]'::jsonb,
  monthly_cost NUMERIC(12, 2)
);

CREATE TABLE outcomes (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 240),
  success_measure TEXT NOT NULL CHECK (char_length(success_measure) BETWEEN 1 AND 1000),
  deadline TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('PLANNED', 'ACTIVE', 'BLOCKED', 'COMPLETED', 'ARCHIVED')),
  priority INTEGER NOT NULL CHECK (priority BETWEEN 1 AND 5)
);

CREATE INDEX outcomes_active_idx ON outcomes(status) WHERE status = 'ACTIVE';
