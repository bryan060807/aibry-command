import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  InventoryBoundaryError,
  resolveContainedPath,
  scanApprovedWindowsRoot,
  scanSelectedWindowsPath,
} from '../../server/inventory/metadata-scan.js';
import {
  assertApprovedReview,
  assertExactManifestHash,
  ManifestIntegrityError,
  ManifestValidationError,
  readAndValidateManifest,
  sanitizeRemoteUrl,
  validateManifest,
} from '../../server/inventory/manifest-review.js';
import type { InventoryManifest } from '../../server/inventory/types.js';

async function withTempDirectory(run: (directory: string) => Promise<void>): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'aibry-command-day10-'));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function metadata(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    packageName: 'synthetic-project',
    scripts: ['test'],
    gitPresent: false,
    branch: 'UNKNOWN',
    remoteUrl: 'UNKNOWN',
    latestLocalCommitDate: 'UNKNOWN',
    frameworkRuntime: 'UNKNOWN',
    readmeDescription: 'Synthetic test project.',
    deploymentConfigPresent: false,
    testsPresent: true,
    ...overrides,
  };
}

function source(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceKey: 'synthetic-source',
    sourceType: 'REPOSITORY',
    sourceRole: 'PRIMARY_REPO',
    host: 'WINDOWS',
    safePathOrIdentifier: 'C:\\synthetic\\project',
    sourceRoot: 'C:\\synthetic',
    metadata: metadata(),
    duplicateSignals: [],
    observedAt: '2026-09-03T12:00:00Z',
    manifestProvenance: 'synthetic-test',
    reviewState: 'PENDING',
    ...overrides,
  };
}

function manifest(overrides: Record<string, unknown> = {}): InventoryManifest {
  return {
    manifestVersion: 'synthetic-day10-test-v1',
    artifactStatus: 'PROPOSED',
    generatedAt: '2026-09-03',
    reviewedAt: '2026-09-03',
    discoveryBoundary: {
      approvedRoots: [],
      manualSourceRoots: [],
      exclusions: ['node_modules', '.env*'],
      executionPolicy: 'NEVER_EXECUTE_DISCOVERED_CODE_OR_PACKAGE_SCRIPTS',
    },
    summary: {
      canonicalProjectCount: 1,
      sourceRecordCount: 1,
      unknownCandidateCount: 0,
      reviewRequiredCandidateCount: 0,
      outcomeCount: 0,
    },
    canonicalProjects: [{
      projectKey: 'synthetic-project',
      name: 'Synthetic Project',
      engine: 'AIBRY_LABS',
      classification: 'SUPPORTING',
      status: 'ACTIVE',
      runtimeState: 'UNKNOWN',
      purpose: 'Synthetic project for isolated tests.',
      links: [],
      monthlyCost: null,
      duplicateSignals: ['synthetic duplicate signal; never merge automatically'],
      reviewState: 'PENDING',
      outcomes: [],
      sources: [source()],
    }],
    reviewCandidates: [{
      candidateKey: 'unknown-candidate',
      projectKey: 'unknown-candidate',
      name: 'unknown-candidate',
      candidateDisposition: 'UNKNOWN',
      engine: 'UNKNOWN',
      classification: 'UNKNOWN',
      status: 'UNKNOWN',
      runtimeState: 'UNKNOWN',
      purpose: 'UNKNOWN',
      links: [],
      monthlyCost: null,
      duplicateSignals: [],
      reviewState: 'PENDING',
      outcomes: [],
      sources: [source({
        sourceKey: 'unknown-candidate-source',
        sourceType: 'MANUAL_PROVENANCE',
        host: 'FEDORA',
        safePathOrIdentifier: '/home/aibry/projects/unknown-candidate',
        sourceRoot: 'FEDORA_MANUAL',
        metadata: metadata({
          packageName: 'UNKNOWN',
          scripts: 'UNKNOWN',
          gitPresent: 'UNKNOWN',
          readmeDescription: 'UNKNOWN',
          testsPresent: 'UNKNOWN',
        }),
      })],
    }],
    excludedCandidates: [],
    importGuards: ['synthetic import only'],
    outcomes: [],
    ...overrides,
  } as unknown as InventoryManifest;
}

test('accepts an existing path inside the approved boundary and rejects traversal/outside paths', async () => {
  await withTempDirectory(async (parent) => {
    const root = path.join(parent, 'approved');
    const inside = path.join(root, 'project');
    const outside = path.join(parent, 'outside');
    await mkdir(inside, { recursive: true });
    await mkdir(outside, { recursive: true });

    assert.equal(await resolveContainedPath(inside, root), await readFilePath(inside));
    await assert.rejects(
      resolveContainedPath(path.join(root, '..', 'outside'), root),
      (error: unknown) => error instanceof InventoryBoundaryError,
    );
    await assert.rejects(
      resolveContainedPath(outside, root),
      (error: unknown) => error instanceof InventoryBoundaryError,
    );
  });
});

async function readFilePath(filePath: string): Promise<string> {
  const { realpath } = await import('node:fs/promises');
  return realpath(filePath);
}

test('rejects symlink and junction escapes when the platform permits creating them', async (t) => {
  await withTempDirectory(async (parent) => {
    const root = path.join(parent, 'approved');
    const outside = path.join(parent, 'outside');
    await mkdir(root, { recursive: true });
    await mkdir(outside, { recursive: true });
    const unavailable: string[] = [];
    let verified = 0;

    for (const variant of [
      { name: 'symlink-escape', type: 'dir' as const },
      { name: 'junction-escape', type: 'junction' as const },
    ]) {
      const link = path.join(root, variant.name);
      try {
        await symlink(outside, link, variant.type);
      } catch (error) {
        unavailable.push(`${variant.name}: ${error instanceof Error ? error.message : 'creation failed'}`);
        continue;
      }
      verified += 1;
      await assert.rejects(
        resolveContainedPath(link, root),
        (error: unknown) => error instanceof InventoryBoundaryError,
      );
    }

    if (verified === 0) {
      t.skip(`NOT VERIFIED: symlink/junction creation unavailable (${unavailable.join(' | ')})`);
    }
  });
});

test('treats case-variant Windows paths as the same resolved identity', async (t) => {
  if (process.platform !== 'win32') {
    t.skip('NOT VERIFIED: Windows case-insensitive duplicate behavior is platform-specific.');
    return;
  }
  await withTempDirectory(async (parent) => {
    const root = path.join(parent, 'approved');
    const project = path.join(root, 'CaseProject');
    await mkdir(project, { recursive: true });
    const differentlyCasedPath = project.toUpperCase();
    const canonical = await resolveContainedPath(project, root);
    const caseVariant = await resolveContainedPath(differentlyCasedPath, root);
    assert.equal(caseVariant, canonical, 'Windows path identity must be case-insensitive after resolution');
  });
});

test('scans bounded metadata only, filters exclusions, preserves PENDING, and never executes project code', async () => {
  const parent = await (async () => {
    const fixtures = path.join(process.cwd(), 'tests', 'fixtures');
    await mkdir(fixtures, { recursive: true });
    return mkdtemp(path.join(fixtures, 'day10-'));
  })();
  try {
    const root = path.join(parent, 'approved');
    const project = path.join(root, 'safe-project');
    await mkdir(path.join(project, 'tests'), { recursive: true });
    for (const excluded of ['node_modules', 'dist', 'build', 'coverage', 'output', 'cache', 'tmp', 'temp', '.env-project', 'media']) {
      await mkdir(path.join(root, excluded), { recursive: true });
    }
    const marker = path.join(project, 'execution-marker.txt');
    await writeFile(marker, 'not-executed', 'utf8');
    await writeFile(path.join(project, 'package.json'), JSON.stringify({
      name: 'safe-project-package',
      scripts: { test: 'node execution-marker.txt', build: 'node never-run.js' },
      dependencies: { react: '^19.0.0' },
    }), 'utf8');
    await writeFile(path.join(project, 'README.md'), 'Synthetic bounded metadata project.', 'utf8');
    await mkdir(path.join(project, '.git'), { recursive: true });
    await writeFile(path.join(project, '.git', 'HEAD'), 'ref: refs/heads/main\n', 'utf8');
    await writeFile(path.join(project, '.git', 'config'), '[remote "origin"]\n\turl = https://user:password@example.com/org/repo.git?token=secret#fragment\n', 'utf8');

    const selected = await scanSelectedWindowsPath(project, root);
    assert.equal(selected.source.reviewState, 'PENDING');
    assert.equal(selected.source.metadata.packageName, 'safe-project-package');
    assert.deepEqual(selected.source.metadata.scripts, ['test', 'build']);
    assert.equal(selected.source.metadata.frameworkRuntime, 'React');
    assert.equal(selected.source.metadata.remoteUrl, 'UNKNOWN');
    assert.equal(await readFile(marker, 'utf8'), 'not-executed');

    await assert.rejects(
      scanApprovedWindowsRoot(root),
      (error: unknown) => error instanceof InventoryBoundaryError,
      'recursive scans must use the fixed approved Windows projects root',
    );
  } finally {
    await rm(parent, { recursive: true, force: true });
  }
});

test('sanitizes or refuses remote URLs containing userinfo, query strings, or fragments', () => {
  assert.equal(sanitizeRemoteUrl('https://github.com/bryan060807/aibry-command.git'), 'https://github.com/bryan060807/aibry-command.git');
  assert.equal(sanitizeRemoteUrl('https://user:password@github.com/org/repo.git'), null);
  assert.equal(sanitizeRemoteUrl('https://github.com/org/repo.git?token=secret'), null);
  assert.equal(sanitizeRemoteUrl('https://github.com/org/repo.git#private'), null);
  assert.equal(sanitizeRemoteUrl('file:///private/repo'), null);
});

test('preserves UNKNOWN and PENDING review state, rejects sensitive fields, and never self-approves', () => {
  const pending = manifest();
  const validated = validateManifest(pending);
  assert.equal(validated.canonicalProjects[0].reviewState, 'PENDING');
  assert.equal(validated.reviewCandidates[0].engine, 'UNKNOWN');
  assert.equal(validated.reviewCandidates[0].purpose, 'UNKNOWN');
  assert.equal(validated.outcomes.length, 0);
  assert.throws(() => assertApprovedReview(validated), (error: unknown) => error instanceof ManifestValidationError);

  const approved = manifest({
    artifactStatus: 'APPROVED',
    canonicalProjects: pending.canonicalProjects.map((project) => ({
      ...project,
      reviewState: 'APPROVED',
      sources: project.sources.map((item) => ({ ...item, reviewState: 'APPROVED' })),
    })),
  });
  assert.doesNotThrow(() => assertApprovedReview(validateManifest(approved)));

  const sensitiveManifest = JSON.parse(JSON.stringify(manifest())) as Record<string, any>;
  sensitiveManifest.canonicalProjects[0].sources[0].metadata.apiKey = 'must-not-be-retained';
  assert.throws(
    () => validateManifest(sensitiveManifest),
    (error: unknown) => error instanceof ManifestValidationError,
  );
});

test('rejects non-empty Outcomes and detects exact manifest hash mismatches', () => {
  assert.throws(
    () => validateManifest(manifest({ outcomes: [{ id: 'outcome-should-not-exist' }] })),
    (error: unknown) => error instanceof ManifestValidationError,
  );
  assert.doesNotThrow(() => assertExactManifestHash('A'.repeat(64), 'a'.repeat(64)));
  assert.throws(
    () => assertExactManifestHash('A'.repeat(64), 'B'.repeat(64)),
    (error: unknown) => error instanceof ManifestIntegrityError,
  );
});

test('rejects a manifest source path outside its reviewed Windows root', () => {
  const original = manifest();
  const outside = manifest({
    discoveryBoundary: {
      approvedRoots: [{ rootKey: 'WINDOWS_PROJECTS', path: 'C:\\approved', scanMode: 'BOUNDED_METADATA_ONLY' }],
      manualSourceRoots: [],
      exclusions: [],
      executionPolicy: 'NEVER_EXECUTE_DISCOVERED_CODE_OR_PACKAGE_SCRIPTS',
    },
    canonicalProjects: original.canonicalProjects.map((project) => ({
      ...project,
      sources: project.sources.map((item) => ({
        ...item,
        sourceRoot: 'WINDOWS_PROJECTS',
        safePathOrIdentifier: 'C:\\outside\\project',
      })),
    })),
  });
  assert.throws(() => validateManifest(outside), (error: unknown) => error instanceof ManifestValidationError);
});

test('read-only validates the lead-approved manifest and verifies its exact hash without importing it', async () => {
  const approvedManifestPath = path.join(process.cwd(), 'docs', 'day10-canonical-manifest.proposed.json');
  const loaded = await readAndValidateManifest(approvedManifestPath);

  assert.equal(loaded.hash, '4D8E52E7B4B16FE224FA8FD56239507DD442377F6087F8FFB5BC75C147D45204');
  assert.equal(loaded.manifest.canonicalProjects.length, 17);
  assert.equal(loaded.manifest.summary.sourceRecordCount, 35);
  assert.equal(loaded.manifest.outcomes.length, 0);
  assert.equal(loaded.manifest.artifactStatus, 'PROPOSED');
});
