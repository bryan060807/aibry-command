import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import { createPgRepository } from '../../server/portfolio/pg-repository.js';
import { importApprovedManifest, InventoryImportError } from '../../server/inventory/import-service.js';
import { ManifestIntegrityError, ManifestValidationError } from '../../server/inventory/manifest-review.js';
import type { InventoryManifest } from '../../server/inventory/types.js';
import type { Pool as PgPool } from 'pg';

type ProjectRecord = {
  id: string;
  name: string;
  engine: string;
  classification: string;
  status: string;
  purpose: string;
  links: string[];
  monthlyCost: number | null;
};

type SourceRecord = {
  id: number;
  projectId: string;
  sourceKey: string;
  values: unknown[];
};

type FakeState = {
  projects: Map<string, ProjectRecord>;
  sources: Map<string, SourceRecord>;
  outcomes: Map<string, { id: string; status: string }>;
};

function cloneState(state: FakeState): FakeState {
  return {
    projects: new Map([...state.projects].map(([id, row]) => [id, { ...row, links: [...row.links] }])),
    sources: new Map([...state.sources].map(([key, row]) => [key, { ...row, values: [...row.values] }])),
    outcomes: new Map([...state.outcomes].map(([id, row]) => [id, { ...row }])),
  };
}

class FakePool {
  state: FakeState;
  failSourceInsert = false;
  transactions: string[] = [];
  private nextSourceId = 1;

  constructor(initial?: Partial<FakeState>) {
    this.state = {
      projects: initial?.projects ?? new Map(),
      sources: initial?.sources ?? new Map(),
      outcomes: initial?.outcomes ?? new Map(),
    };
  }

  async connect(): Promise<FakeClient> {
    return new FakeClient(this);
  }

  snapshot(): FakeState {
    return cloneState(this.state);
  }

  allocateSourceId(): number {
    return this.nextSourceId++;
  }
}

class FakeClient {
  private transactionState: FakeState | null = null;

  constructor(private readonly pool: FakePool) {}

  private get state(): FakeState {
    if (!this.transactionState) throw new Error('Fake client query was attempted outside a transaction.');
    return this.transactionState;
  }

  async query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<{ rowCount: number; rows: T[] }> {
    const sql = text.replace(/\s+/g, ' ').trim();
    if (sql === 'BEGIN') {
      this.transactionState = this.pool.snapshot();
      this.pool.transactions.push('BEGIN');
      return { rowCount: null as unknown as number, rows: [] };
    }
    if (sql === 'COMMIT') {
      if (!this.transactionState) throw new Error('COMMIT without BEGIN');
      this.pool.state = this.transactionState;
      this.transactionState = null;
      this.pool.transactions.push('COMMIT');
      return { rowCount: null as unknown as number, rows: [] };
    }
    if (sql === 'ROLLBACK') {
      this.transactionState = null;
      this.pool.transactions.push('ROLLBACK');
      return { rowCount: null as unknown as number, rows: [] };
    }

    if (sql.startsWith('SELECT id, name FROM projects')) {
      const row = this.state.projects.get(String(params[0]));
      return { rowCount: row ? 1 : 0, rows: row ? [{ id: row.id, name: row.name } as T] : [] };
    }
    if (sql.startsWith('UPDATE projects SET')) {
      const id = String(params[0]);
      const row = this.state.projects.get(id);
      if (!row) throw new Error(`Missing project ${id}`);
      Object.assign(row, {
        name: String(params[1]), engine: String(params[2]), classification: String(params[3]), status: String(params[4]),
        purpose: String(params[5]), links: JSON.parse(String(params[6])), monthlyCost: params[7] as number | null,
      });
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith('INSERT INTO projects')) {
      const id = String(params[0]);
      if (this.state.projects.has(id)) throw new Error(`Duplicate project ${id}`);
      this.state.projects.set(id, {
        id, name: String(params[1]), engine: String(params[2]), classification: String(params[3]), status: String(params[4]),
        purpose: String(params[5]), links: JSON.parse(String(params[6])), monthlyCost: params[7] as number | null,
      });
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith('SELECT id, project_id FROM project_sources')) {
      const row = [...this.state.sources.values()].find((item) => item.sourceKey === String(params[0]));
      return { rowCount: row ? 1 : 0, rows: row ? [{ id: String(row.id), project_id: row.projectId } as T] : [] };
    }
    if (sql.startsWith('UPDATE project_sources SET')) {
      const key = `${String(params[0])}:${String(params[1])}`;
      const row = this.state.sources.get(key);
      if (!row) throw new Error(`Missing source ${key}`);
      row.values = [...params];
      return { rowCount: 1, rows: [] };
    }
    if (sql.startsWith('INSERT INTO project_sources')) {
      if (this.pool.failSourceInsert) throw new Error('Synthetic source insert failure');
      const key = `${String(params[0])}:${String(params[1])}`;
      if (this.state.sources.has(key)) throw new Error(`Duplicate source ${key}`);
      this.state.sources.set(key, { id: this.pool.allocateSourceId(), projectId: String(params[0]), sourceKey: String(params[1]), values: [...params] });
      return { rowCount: 1, rows: [] };
    }
    throw new Error(`Unhandled synthetic SQL: ${sql}`);
  }

  release(): void {}
}

function source(sourceKey: string, role: string = 'PRIMARY_REPO'): Record<string, unknown> {
  return {
    sourceKey,
    sourceType: 'REPOSITORY',
    sourceRole: role,
    host: 'WINDOWS',
    safePathOrIdentifier: `C:\\synthetic\\${sourceKey}`,
    sourceRoot: 'C:\\synthetic',
    metadata: {
      packageName: sourceKey,
      scripts: ['test'],
      gitPresent: false,
      branch: 'UNKNOWN',
      remoteUrl: 'UNKNOWN',
      latestLocalCommitDate: 'UNKNOWN',
      frameworkRuntime: 'UNKNOWN',
      readmeDescription: 'Synthetic integration source.',
      deploymentConfigPresent: false,
      testsPresent: true,
    },
    duplicateSignals: [],
    observedAt: '2026-09-03T12:00:00Z',
    manifestProvenance: 'synthetic-integration-test',
    reviewState: 'APPROVED',
  };
}

function approvedManifest(): InventoryManifest {
  return {
    manifestVersion: 'synthetic-day10-import-v1',
    artifactStatus: 'APPROVED',
    generatedAt: '2026-09-03',
    reviewedAt: '2026-09-03',
    discoveryBoundary: { approvedRoots: [], manualSourceRoots: [], exclusions: [], executionPolicy: 'NEVER_EXECUTE_DISCOVERED_CODE_OR_PACKAGE_SCRIPTS' },
    summary: { canonicalProjectCount: 2, sourceRecordCount: 3, unknownCandidateCount: 0, reviewRequiredCandidateCount: 0, outcomeCount: 0 },
    canonicalProjects: [
      {
        projectKey: 'aibry-command', name: 'AIBRY Command', engine: 'AIBRY_LABS', classification: 'SUPPORTING', status: 'ACTIVE',
        runtimeState: 'UNKNOWN', purpose: 'Synthetic existing seeded project.', links: [], monthlyCost: null, duplicateSignals: ['existing seeded identity'],
        reviewState: 'APPROVED', outcomes: [], sources: [source('command-primary'), source('command-secondary', 'REFERENCE')],
      },
      {
        projectKey: 'synthetic-project', name: 'Synthetic Project', engine: 'AIBRY_LABS', classification: 'SUPPORTING', status: 'ACTIVE',
        runtimeState: 'UNKNOWN', purpose: 'Synthetic import target.', links: [], monthlyCost: null, duplicateSignals: ['reviewed duplicate signal only'],
        reviewState: 'APPROVED', outcomes: [], sources: [source('synthetic-primary')],
      },
    ],
    reviewCandidates: [],
    excludedCandidates: [],
    importGuards: ['synthetic test artifact only'],
    outcomes: [],
  } as unknown as InventoryManifest;
}

async function writeSyntheticManifest(manifest: InventoryManifest): Promise<{ manifestPath: string; hash: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aibry-command-import-'));
  const manifestPath = path.join(directory, 'synthetic-manifest.json');
  const bytes = Buffer.from(JSON.stringify(manifest, null, 2));
  await writeFile(manifestPath, bytes);
  const { createHash } = await import('node:crypto');
  return { manifestPath, hash: createHash('sha256').update(bytes).digest('hex').toUpperCase() };
}

function seededPool(): FakePool {
  return new FakePool({
    projects: new Map([['project-aibry-command', {
      id: 'project-aibry-command', name: 'AIBRY Command', engine: 'AIBRY_LABS', classification: 'SUPPORTING', status: 'ACTIVE',
      purpose: 'Old seed purpose', links: [], monthlyCost: null,
    }]]),
    outcomes: new Map([['existing-outcome', { id: 'existing-outcome', status: 'ACTIVE' }]]),
  });
}

async function cleanupManifest(manifestPath: string): Promise<void> {
  await rm(path.dirname(manifestPath), { recursive: true, force: true });
}

test('imports multiple sources transactionally, matches seeded AIBRY Command, and creates zero Outcomes', async () => {
  const fixture = await writeSyntheticManifest(approvedManifest());
  try {
    const pool = seededPool();
    const result = await importApprovedManifest({ pool: pool as unknown as PgPool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'APPROVED' });
    assert.deepEqual(result, {
      projectCount: 2, sourceCount: 3, createdProjectCount: 1, updatedProjectCount: 1,
      createdSourceCount: 3, updatedSourceCount: 0, manifestSha256: fixture.hash,
    });
    assert.equal(pool.state.projects.size, 2, 'seeded AIBRY Command must not be duplicated');
    assert.equal(pool.state.sources.size, 3, 'multiple sources must attach to canonical projects');
    assert.deepEqual([...pool.state.outcomes.keys()], ['existing-outcome'], 'import must create zero Outcomes');
    assert.deepEqual(pool.transactions, ['BEGIN', 'COMMIT']);
  } finally {
    await cleanupManifest(fixture.manifestPath);
  }
});

test('re-import is idempotent and updates existing provenance without duplicates', async () => {
  const fixture = await writeSyntheticManifest(approvedManifest());
  try {
    const pool = seededPool();
    const first = await importApprovedManifest({ pool: pool as unknown as PgPool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'APPROVED' });
    const second = await importApprovedManifest({ pool: pool as unknown as PgPool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'APPROVED' });
    assert.equal(first.createdProjectCount, 1);
    assert.equal(second.createdProjectCount, 0);
    assert.equal(second.updatedProjectCount, 2);
    assert.equal(second.createdSourceCount, 0);
    assert.equal(second.updatedSourceCount, 3);
    assert.equal(pool.state.projects.size, 2);
    assert.equal(pool.state.sources.size, 3);
    assert.deepEqual(pool.transactions, ['BEGIN', 'COMMIT', 'BEGIN', 'COMMIT']);
  } finally {
    await cleanupManifest(fixture.manifestPath);
  }
});

test('rolls back the whole import when a source persistence step fails', async () => {
  const fixture = await writeSyntheticManifest(approvedManifest());
  try {
    const pool = seededPool();
    pool.failSourceInsert = true;
    const before = pool.snapshot();
    await assert.rejects(
      importApprovedManifest({ pool: pool as unknown as PgPool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'APPROVED' }),
      /Synthetic source insert failure/,
    );
    assert.deepEqual(pool.snapshot(), before, 'failed import must leave no partial project/source records');
    assert.deepEqual(pool.transactions, ['BEGIN', 'ROLLBACK']);
  } finally {
    await cleanupManifest(fixture.manifestPath);
  }
});

test('requires external approval and exact immutable artifact hash before opening a pool transaction', async () => {
  const fixture = await writeSyntheticManifest(approvedManifest());
  try {
    const pool = seededPool();
    await assert.rejects(
      importApprovedManifest({ pool: pool as unknown as PgPool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'PENDING' as 'APPROVED' }),
      (error: unknown) => error instanceof InventoryImportError,
    );
    await assert.rejects(
      importApprovedManifest({ pool: pool as unknown as PgPool, manifestPath: fixture.manifestPath, expectedSha256: '0'.repeat(64), approvalState: 'APPROVED' }),
      (error: unknown) => error instanceof ManifestIntegrityError,
    );
    assert.deepEqual(pool.transactions, []);
  } finally {
    await cleanupManifest(fixture.manifestPath);
  }
});

test('refuses rejected canonical review and preserves UNKNOWN candidates without importing them', async () => {
  const pending = approvedManifest();
  pending.canonicalProjects = pending.canonicalProjects.map((project) => project.projectKey === 'synthetic-project' ? {
    ...project,
    reviewState: 'REJECTED',
  } : project);
  assert.equal(pending.canonicalProjects.find((project) => project.projectKey === 'synthetic-project')?.reviewState, 'REJECTED');
  const fixture = await writeSyntheticManifest(pending);
  try {
    const pool = seededPool();
    await assert.rejects(
      importApprovedManifest({ pool: pool as unknown as PgPool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'APPROVED' }),
      (error: unknown) => error instanceof ManifestValidationError,
    );
    assert.equal(pool.state.projects.size, 1);
    assert.equal(pool.state.sources.size, 0);
  } finally {
    await cleanupManifest(fixture.manifestPath);
  }
});

function localTestDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    const host = parsed.hostname.toLowerCase();
    const database = decodeURIComponent(parsed.pathname.replace(/^\/+/, '')).toLowerCase();
    return ['localhost', '127.0.0.1', '::1'].includes(host) && database.includes('test');
  } catch {
    return false;
  }
}

const configuredTestDatabase = process.env.AIBRY_COMMAND_TEST_DATABASE_URL;
const realConcurrencySkip = configuredTestDatabase
  ? 'NOT VERIFIED: AIBRY_COMMAND_TEST_DATABASE_URL is not an explicitly local/test-safe URL.'
  : 'NOT VERIFIED: AIBRY_COMMAND_TEST_DATABASE_URL is not configured.';
const realImportSkip = configuredTestDatabase
  ? 'NOT VERIFIED: AIBRY_COMMAND_TEST_DATABASE_URL is not an explicitly local/test-safe URL.'
  : 'NOT VERIFIED: AIBRY_COMMAND_TEST_DATABASE_URL is not configured.';

test('imports synthetic inventory transactionally against real PostgreSQL with idempotency and rollback', {
  skip: localTestDatabaseUrl(configuredTestDatabase) ? false : realImportSkip,
}, async () => {
  const connectionString = configuredTestDatabase as string;
  const schema = `aibry_command_day10_import_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new Pool({ connectionString, max: 2 });
  const pool = new Pool({ connectionString, max: 2, options: `-c search_path=${schema}` });
  let fixture: { manifestPath: string; hash: string } | null = null;
  let collisionFixture: { manifestPath: string; hash: string } | null = null;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await pool.query(await readFile(path.join(process.cwd(), 'db/migrations/001_initial_portfolio_outcome.sql'), 'utf8'));
    await pool.query(await readFile(path.join(process.cwd(), 'db/migrations/002_inventory_provenance.sql'), 'utf8'));
    await pool.query(
      'INSERT INTO projects (id, name, engine, classification, status, purpose, links, monthly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)',
      ['project-aibry-command', 'AIBRY Command', 'AIBRY_LABS', 'SUPPORTING', 'ACTIVE', 'Old seed purpose', '[]', null],
    );
    await pool.query(
      'INSERT INTO outcomes (id, project_id, title, success_measure, status, priority) VALUES ($1, $2, $3, $4, $5, $6)',
      ['outcome-existing-import-test', 'project-aibry-command', 'Existing outcome', 'Must remain untouched', 'PLANNED', 1],
    );

    fixture = await writeSyntheticManifest(approvedManifest());
    const first = await importApprovedManifest({ pool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'APPROVED' });
    assert.equal(first.createdProjectCount, 1);
    assert.equal(first.updatedProjectCount, 1);
    assert.equal(first.createdSourceCount, 3);
    assert.equal(first.updatedSourceCount, 0);

    const afterFirstProjects = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM projects');
    const afterFirstSources = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM project_sources');
    const afterFirstOutcomes = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM outcomes');
    assert.equal(afterFirstProjects.rows[0].count, '2');
    assert.equal(afterFirstSources.rows[0].count, '3');
    assert.equal(afterFirstOutcomes.rows[0].count, '1', 'real PostgreSQL import must create zero Outcomes');

    const second = await importApprovedManifest({ pool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'APPROVED' });
    assert.equal(second.createdProjectCount, 0);
    assert.equal(second.updatedProjectCount, 2);
    assert.equal(second.createdSourceCount, 0);
    assert.equal(second.updatedSourceCount, 3);
    const afterSecondSources = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM project_sources');
    assert.equal(afterSecondSources.rows[0].count, '3', 'real PostgreSQL re-import must not duplicate provenance');

    await assert.rejects(
      importApprovedManifest({ pool, manifestPath: fixture.manifestPath, expectedSha256: fixture.hash, approvalState: 'PENDING' as 'APPROVED' }),
      (error: unknown) => error instanceof InventoryImportError,
    );
    await assert.rejects(
      importApprovedManifest({ pool, manifestPath: fixture.manifestPath, expectedSha256: '0'.repeat(64), approvalState: 'APPROVED' }),
      (error: unknown) => error instanceof ManifestIntegrityError,
    );

    const baseCollision = approvedManifest();
    const commandSource = baseCollision.canonicalProjects.find((project) => project.projectKey === 'aibry-command')?.sources[0];
    assert.ok(commandSource, 'synthetic collision fixture requires an AIBRY Command source');
    const collisionManifest = {
      ...baseCollision,
      canonicalProjects: baseCollision.canonicalProjects.map((project) => {
        if (project.projectKey === 'aibry-command') {
          return { ...project, purpose: 'Purpose that must roll back.', sources: project.sources.slice(1) };
        }
        if (project.projectKey === 'synthetic-project') {
          return { ...project, sources: [...project.sources, commandSource] };
        }
        return project;
      }),
    } as InventoryManifest;
    collisionFixture = await writeSyntheticManifest(collisionManifest);
    await assert.rejects(
      importApprovedManifest({ pool, manifestPath: collisionFixture.manifestPath, expectedSha256: collisionFixture.hash, approvalState: 'APPROVED' }),
      /Source key collision/,
    );

    const rolledBackProject = await pool.query<{ purpose: string }>('SELECT purpose FROM projects WHERE id = $1', ['project-aibry-command']);
    const rolledBackSources = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM project_sources');
    const rolledBackOutcomes = await pool.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM outcomes');
    assert.equal(rolledBackProject.rows[0].purpose, 'Synthetic existing seeded project.', 'failed import must roll back earlier project updates');
    assert.equal(rolledBackSources.rows[0].count, '3', 'failed import must not alter persisted provenance');
    assert.equal(rolledBackOutcomes.rows[0].count, '1', 'failed import must not alter Outcomes');
  } finally {
    if (fixture) await cleanupManifest(fixture.manifestPath);
    if (collisionFixture) await cleanupManifest(collisionFixture.manifestPath);
    await pool.end();
    try {
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    } finally {
      await admin.end();
    }
  }
});

test('proves concurrent activation never commits more than three active Outcomes on separate PostgreSQL connections', {
  skip: localTestDatabaseUrl(configuredTestDatabase) ? false : realConcurrencySkip,
}, async () => {
  const connectionString = configuredTestDatabase as string;
  const schema = `aibry_command_day10_test_${process.pid}_${Math.random().toString(36).slice(2, 10)}`;
  const admin = new Pool({ connectionString, max: 2 });
  const setup = new Pool({ connectionString, max: 1, options: `-c search_path=${schema}` });
  const workers: Pool[] = [];
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    await setup.query(await readFile(path.join(process.cwd(), 'db/migrations/001_initial_portfolio_outcome.sql'), 'utf8'));
    await setup.query(await readFile(path.join(process.cwd(), 'db/migrations/002_inventory_provenance.sql'), 'utf8'));
    await setup.query(
      'INSERT INTO projects (id, name, engine, classification, status, purpose, links, monthly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)',
      ['project-concurrency-test', 'Concurrency Test Project', 'AIBRY_LABS', 'SUPPORTING', 'ACTIVE', 'Isolated test project.', '[]', null],
    );
    const outcomeIds = ['one', 'two', 'three', 'four'].map((suffix) => `outcome-concurrency-${suffix}`);
    for (const [index, outcomeId] of outcomeIds.entries()) {
      await setup.query(
        'INSERT INTO outcomes (id, project_id, title, success_measure, status, priority) VALUES ($1, $2, $3, $4, $5, $6)',
        [outcomeId, 'project-concurrency-test', outcomeId, 'committed activation', 'PLANNED', index + 1],
      );
    }

    const attempts = outcomeIds.map((outcomeId) => {
      const pool = new Pool({ connectionString, max: 1, options: `-c search_path=${schema}` });
      workers.push(pool);
      return createPgRepository(pool).activateOutcome(outcomeId)
        .then(() => ({ ok: true, code: null }))
        .catch((error: unknown) => ({ ok: false, code: (error as { code?: string }).code ?? null }));
    });
    const results = await Promise.all(attempts);
    const active = await setup.query<{ count: string }>("SELECT count(*)::text AS count FROM outcomes WHERE status = 'ACTIVE'");
    assert.equal(active.rows[0].count, '3');
    assert.equal(results.filter((result) => result.ok).length, 3);
    assert.deepEqual(results.filter((result) => !result.ok).map((result) => result.code), ['ACTIVE_OUTCOME_LIMIT']);
  } finally {
    for (const worker of workers) await worker.end();
    await setup.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
