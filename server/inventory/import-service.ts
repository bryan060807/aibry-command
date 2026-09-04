import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { Project } from '../portfolio/types.js';
import { assertCanonicalImportable, assertExactManifestHash, readAndValidateManifest } from './manifest-review.js';
import type { InventoryManifest, InventoryProject, InventorySource, ReviewState } from './types.js';

export class InventoryImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryImportError';
  }
}

export interface InventoryImportOptions {
  pool: Pool;
  manifestPath: string;
  expectedSha256: string;
  approvalState: ReviewState;
}

export interface InventoryImportResult {
  projectCount: number;
  sourceCount: number;
  createdProjectCount: number;
  updatedProjectCount: number;
  createdSourceCount: number;
  updatedSourceCount: number;
  manifestSha256: string;
}

function supportedProject(project: InventoryProject): Project {
  if (project.engine === 'UNKNOWN' || project.classification === 'UNKNOWN' || project.status === 'UNKNOWN' || project.purpose === 'UNKNOWN') {
    throw new InventoryImportError(`Project ${project.projectKey} contains unresolved import fields.`);
  }
  if (!/^project-[a-z0-9-]{1,100}$/.test(`project-${project.projectKey}`)) throw new InventoryImportError(`Project key ${project.projectKey} is unsafe.`);
  return {
    id: `project-${project.projectKey}`,
    name: project.name,
    engine: project.engine,
    classification: project.classification,
    status: project.status,
    purpose: project.purpose,
    links: project.links,
    monthlyCost: project.monthlyCost,
  } as Project;
}

function sourceMetadata(source: InventorySource): Record<string, unknown> {
  return source.metadata as unknown as Record<string, unknown>;
}

function nullableBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function nullableTimestamp(value: unknown): string | null {
  return typeof value === 'string' && value !== 'UNKNOWN' ? value : null;
}

async function persistProject(client: PoolClient, project: Project): Promise<'created' | 'updated'> {
  const existing = await client.query<{ id: string; name: string }>('SELECT id, name FROM projects WHERE id = $1 FOR UPDATE', [project.id]);
  if (existing.rowCount && existing.rows[0].name !== project.name) throw new InventoryImportError(`Project identity conflict for ${project.id}.`);
  if (existing.rowCount) {
    await client.query(
      'UPDATE projects SET name = $2, engine = $3, classification = $4, status = $5, purpose = $6, links = $7::jsonb, monthly_cost = $8 WHERE id = $1',
      [project.id, project.name, project.engine, project.classification, project.status, project.purpose, JSON.stringify(project.links), project.monthlyCost],
    );
    return 'updated';
  }
  await client.query(
    'INSERT INTO projects (id, name, engine, classification, status, purpose, links, monthly_cost) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)',
    [project.id, project.name, project.engine, project.classification, project.status, project.purpose, JSON.stringify(project.links), project.monthlyCost],
  );
  return 'created';
}

async function persistSource(client: PoolClient, projectId: string, source: InventorySource, manifestSha256: string): Promise<'created' | 'updated'> {
  const metadata = sourceMetadata(source);
  const existing = await client.query<{ id: string; project_id: string }>('SELECT id, project_id FROM project_sources WHERE source_key = $1 FOR UPDATE', [source.sourceKey]);
  if (existing.rowCount && existing.rows[0].project_id !== projectId) {
    throw new InventoryImportError(`Source key collision for ${source.sourceKey}; refusing cross-project attachment.`);
  }
  const values = [projectId, source.sourceKey, source.sourceType, source.sourceRole, source.host, source.safePathOrIdentifier, source.sourceRoot, metadata.packageName === 'UNKNOWN' ? null : metadata.packageName, metadata.scripts === 'UNKNOWN' ? null : JSON.stringify(metadata.scripts), nullableBoolean(metadata.gitPresent), metadata.branch === 'UNKNOWN' ? null : metadata.branch, metadata.remoteUrl === 'UNKNOWN' ? null : metadata.remoteUrl, nullableTimestamp(metadata.latestLocalCommitDate), metadata.frameworkRuntime === 'UNKNOWN' ? null : metadata.frameworkRuntime, metadata.readmeDescription === 'UNKNOWN' ? null : metadata.readmeDescription, nullableBoolean(metadata.deploymentConfigPresent), nullableBoolean(metadata.testsPresent), JSON.stringify(source.duplicateSignals), source.observedAt, source.manifestProvenance, manifestSha256, source.reviewState];
  if (existing.rowCount) {
    await client.query(
      `UPDATE project_sources SET source_type = $3, source_role = $4, host = $5, source_identifier = $6, approved_source_root = $7,
       package_name = $8, scripts = $9::jsonb, git_present = $10, branch = $11, sanitized_remote = $12, latest_commit_date = $13,
       framework_runtime = $14, readme_description = $15, deployment_config_present = $16, tests_present = $17,
       duplicate_signals = $18::jsonb, observed_at = $19, manifest_provenance = $20, manifest_sha256 = $21, review_state = $22
       WHERE project_id = $1 AND source_key = $2`, values,
    );
    return 'updated';
  }
  await client.query(
    `INSERT INTO project_sources (project_id, source_key, source_type, source_role, host, source_identifier, approved_source_root,
      package_name, scripts, git_present, branch, sanitized_remote, latest_commit_date, framework_runtime, readme_description,
      deployment_config_present, tests_present, duplicate_signals, observed_at, manifest_provenance, manifest_sha256, review_state)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, $20, $21, $22)`, values,
  );
  return 'created';
}

export async function importApprovedManifest(options: InventoryImportOptions): Promise<InventoryImportResult> {
  if (options.approvalState !== 'APPROVED') throw new InventoryImportError('Import requires explicit external approval.');
  const loaded = await readAndValidateManifest(options.manifestPath);
  assertExactManifestHash(loaded.hash, options.expectedSha256);
  assertCanonicalImportable(loaded.manifest);
  let manifest: InventoryManifest = loaded.manifest;
  const poolClient = await options.pool.connect();
  let createdProjectCount = 0;
  let updatedProjectCount = 0;
  let createdSourceCount = 0;
  let updatedSourceCount = 0;
  try {
    // Re-read and re-hash the exact file immediately before BEGIN. The first
    // read is only preparation; the second read is the import payload.
    const finalLoaded = await readAndValidateManifest(options.manifestPath);
    assertExactManifestHash(finalLoaded.hash, options.expectedSha256);
    if (finalLoaded.hash !== loaded.hash) throw new InventoryImportError('Manifest changed during import preparation.');
    assertCanonicalImportable(finalLoaded.manifest);
    manifest = finalLoaded.manifest;
    await poolClient.query('BEGIN');
    const projects = manifest.canonicalProjects.map(supportedProject);
    for (const project of manifest.canonicalProjects) {
      const persisted = await persistProject(poolClient, supportedProject(project));
      if (persisted === 'created') createdProjectCount += 1;
      else updatedProjectCount += 1;
      for (const source of project.sources) {
        const sourceResult = await persistSource(poolClient, `project-${project.projectKey}`, source as InventorySource, loaded.hash);
        if (sourceResult === 'created') createdSourceCount += 1;
        else updatedSourceCount += 1;
      }
    }
    await poolClient.query('COMMIT');
    return { projectCount: projects.length, sourceCount: manifest.canonicalProjects.reduce((sum, project) => sum + project.sources.length, 0), createdProjectCount, updatedProjectCount, createdSourceCount, updatedSourceCount, manifestSha256: loaded.hash };
  } catch (error) {
    await poolClient.query('ROLLBACK');
    throw error;
  } finally {
    poolClient.release();
  }
}

export function hashManifestBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex').toUpperCase();
}
