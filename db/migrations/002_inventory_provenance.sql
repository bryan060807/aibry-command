-- Day 10 bounded inventory provenance. Apply only through the approved migration process.
-- This relation stores safe metadata/provenance, not source code or runtime state.

CREATE TABLE project_sources (
  id BIGSERIAL PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  source_key TEXT NOT NULL CHECK (char_length(source_key) BETWEEN 1 AND 100),
  source_type TEXT NOT NULL CHECK (source_type IN ('REPOSITORY', 'MANUAL_PROVENANCE', 'REFERENCE')),
  source_role TEXT NOT NULL CHECK (source_role IN ('PRIMARY_REPO', 'UI_REPO', 'API_REPO', 'BRIDGE', 'LEGACY', 'RUNTIME', 'DATA_DEPENDENCY', 'SUPPORT', 'REFERENCE')),
  host TEXT NOT NULL CHECK (host IN ('WINDOWS', 'FEDORA', 'UNKNOWN')),
  source_identifier TEXT NOT NULL CHECK (char_length(source_identifier) BETWEEN 1 AND 1000),
  approved_source_root TEXT NOT NULL CHECK (char_length(approved_source_root) BETWEEN 1 AND 1000),
  package_name TEXT,
  scripts JSONB,
  git_present BOOLEAN,
  branch TEXT,
  sanitized_remote TEXT,
  latest_commit_date TIMESTAMPTZ,
  framework_runtime TEXT,
  readme_description TEXT,
  deployment_config_present BOOLEAN,
  tests_present BOOLEAN,
  duplicate_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL,
  manifest_provenance TEXT NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[A-Fa-f0-9]{64}$'),
  review_state TEXT NOT NULL CHECK (review_state IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_key)
);

CREATE INDEX project_sources_project_idx ON project_sources(project_id);
CREATE INDEX project_sources_manifest_idx ON project_sources(manifest_sha256);
