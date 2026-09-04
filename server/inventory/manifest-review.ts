import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type {
  InventoryBoundary,
  InventoryManifest,
  InventorySource,
  InventoryUnknown,
  ReviewState,
} from './types.js';
import { REVIEW_STATES } from './types.js';

const UNKNOWN: InventoryUnknown = 'UNKNOWN';
const SAFE_KEY = /^[a-z0-9][a-z0-9-]{0,99}$/;
const SAFE_DATE = /^\d{4}-\d{2}-\d{2}(?:T[^\s]+)?$/;
const SENSITIVE_KEY = /(password|secret|token|credential|private.?key|api.?key|auth.?header|session|invite)/i;
const SECRET_LIKE_VALUE = /(password|passwd|secret|token|api[_ -]?key|private[_ -]?key|bearer)\s*[:=]/i;
const FORBIDDEN_ROOTS = ['c:\\aibry\\music-vault', 'c:\\aibry\\shared_folder'];
const FORBIDDEN_SEGMENTS = new Set([
  '.env', 'credentials', 'credential', 'secrets', 'secret', 'tokens', 'token', 'keys', 'key', 'passwords', 'password',
  'sessions', 'session', 'invites', 'invite', 'node_modules', 'vendor', 'dist', 'build', 'coverage', 'output', 'cache',
  'tmp', 'temp', 'backups', 'backup', 'database-dumps', 'db-dumps', 'media', 'captures', 'camera-captures', 'music-vault',
  'shared_folder', 'genealogy', 'person-data', 'personal-data',
]);

export class ManifestValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Inventory manifest validation failed: ${issues.join('; ')}`);
    this.name = 'ManifestValidationError';
  }
}

export class ManifestIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestIntegrityError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isReviewState(value: unknown): value is ReviewState {
  return typeof value === 'string' && REVIEW_STATES.includes(value as ReviewState);
}

function isUnknown(value: unknown): value is InventoryUnknown {
  return value === UNKNOWN;
}

function isUnknownOrString(value: unknown): value is string | InventoryUnknown {
  return isUnknown(value) || (typeof value === 'string' && value.length > 0);
}

function isUnknownOrBoolean(value: unknown): value is boolean | InventoryUnknown {
  return isUnknown(value) || typeof value === 'boolean';
}

function isUnknownOrStringArray(value: unknown): value is string[] | InventoryUnknown {
  return isUnknown(value) || (Array.isArray(value) && value.every((item) => typeof item === 'string'));
}

function normalizedPath(value: string): string {
  return value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function containsForbiddenPath(value: string): boolean {
  const normalized = normalizedPath(value);
  if (FORBIDDEN_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}\\`))) return true;
  return normalized.split(/[\\/]+/).some((segment) => FORBIDDEN_SEGMENTS.has(segment) || segment.startsWith('.env'));
}

function containsSecretLikeValue(value: string): boolean {
  return SECRET_LIKE_VALUE.test(value) || /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function walkForSensitiveKeys(value: unknown, path: string, issues: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForSensitiveKeys(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) issues.push(`${path}.${key} is not permitted`);
    walkForSensitiveKeys(child, `${path}.${key}`, issues);
  }
}

function walkForSensitiveValues(value: unknown, path: string, issues: string[]): void {
  if (typeof value === 'string') {
    if (containsSecretLikeValue(value)) issues.push(`${path} contains a secret-like value`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkForSensitiveValues(item, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  Object.entries(value).forEach(([key, child]) => walkForSensitiveValues(child, `${path}.${key}`, issues));
}

function normalizedBoundaryPath(value: string): string {
  return value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase();
}

function sourceIsInsideBoundary(source: InventorySource, boundary: InventoryBoundary): boolean {
  if (source.host !== 'WINDOWS' || boundary.approvedRoots.length === 0) return true;
  const root = boundary.approvedRoots.find((item) => item.rootKey === source.sourceRoot);
  if (!root) return false;
  const candidate = normalizedBoundaryPath(source.safePathOrIdentifier);
  const approved = normalizedBoundaryPath(root.path);
  return candidate !== approved && candidate.startsWith(`${approved}\\`);
}

function sourceHasReviewedRoot(source: InventorySource, boundary: InventoryBoundary): boolean {
  if (source.host === 'WINDOWS') return boundary.approvedRoots.length === 0 || boundary.approvedRoots.some((item) => item.rootKey === source.sourceRoot);
  if (source.host === 'FEDORA') return boundary.manualSourceRoots.length === 0 || boundary.manualSourceRoots.some((item) => item.rootKey === source.sourceRoot);
  return true;
}

function validateSource(source: unknown, path: string, issues: string[]): source is InventorySource {
  if (!isRecord(source)) {
    issues.push(`${path} must be an object`);
    return false;
  }
  if (typeof source.sourceKey !== 'string' || !SAFE_KEY.test(source.sourceKey)) issues.push(`${path}.sourceKey is invalid`);
  if (!['REPOSITORY', 'MANUAL_PROVENANCE', 'REFERENCE'].includes(String(source.sourceType))) issues.push(`${path}.sourceType is invalid`);
  if (!['PRIMARY_REPO', 'UI_REPO', 'API_REPO', 'BRIDGE', 'LEGACY', 'RUNTIME', 'DATA_DEPENDENCY', 'SUPPORT', 'REFERENCE'].includes(String(source.sourceRole))) {
    issues.push(`${path}.sourceRole is invalid`);
  }
  if (!['WINDOWS', 'FEDORA', 'UNKNOWN'].includes(String(source.host))) issues.push(`${path}.host is invalid`);
  for (const field of ['safePathOrIdentifier', 'sourceRoot', 'observedAt', 'manifestProvenance']) {
    if (typeof source[field] !== 'string' || source[field].length === 0) issues.push(`${path}.${field} is required`);
  }
  if (typeof source.safePathOrIdentifier === 'string' && (source.safePathOrIdentifier.length > 1000 || containsForbiddenPath(source.safePathOrIdentifier) || containsSecretLikeValue(source.safePathOrIdentifier))) issues.push(`${path}.safePathOrIdentifier is not safe`);
  if (typeof source.sourceRoot === 'string' && (source.sourceRoot.length > 1000 || containsForbiddenPath(source.sourceRoot) || containsSecretLikeValue(source.sourceRoot))) issues.push(`${path}.sourceRoot is not safe`);
  if (typeof source.manifestProvenance === 'string' && (source.manifestProvenance.length > 500 || containsSecretLikeValue(source.manifestProvenance))) issues.push(`${path}.manifestProvenance is not safe`);
  if (typeof source.observedAt === 'string' && !SAFE_DATE.test(source.observedAt)) issues.push(`${path}.observedAt is invalid`);
  if (!Array.isArray(source.duplicateSignals) || source.duplicateSignals.some((item) => typeof item !== 'string')) issues.push(`${path}.duplicateSignals is invalid`);
  if (!isReviewState(source.reviewState)) issues.push(`${path}.reviewState is invalid`);
  if (!isRecord(source.metadata)) {
    issues.push(`${path}.metadata is required`);
  } else {
    const metadataFields = ['packageName', 'scripts', 'gitPresent', 'branch', 'remoteUrl', 'latestLocalCommitDate', 'frameworkRuntime', 'readmeDescription', 'deploymentConfigPresent', 'testsPresent'];
    for (const field of metadataFields) {
      if (!(field in source.metadata)) issues.push(`${path}.metadata.${field} is required`);
    }
    for (const field of ['packageName', 'branch', 'frameworkRuntime', 'readmeDescription']) {
      const value = source.metadata[field];
      if (!isUnknownOrString(value) || (typeof value === 'string' && (value.length > 4096 || containsSecretLikeValue(value)))) {
        issues.push(`${path}.metadata.${field} must be a safe string or UNKNOWN`);
      }
    }
    if (!isUnknownOrStringArray(source.metadata.scripts) || (Array.isArray(source.metadata.scripts) && source.metadata.scripts.some((item) => item.length > 200 || containsSecretLikeValue(item)))) {
      issues.push(`${path}.metadata.scripts must be a safe string array or UNKNOWN`);
    }
    for (const field of ['gitPresent', 'deploymentConfigPresent', 'testsPresent']) {
      if (!isUnknownOrBoolean(source.metadata[field])) issues.push(`${path}.metadata.${field} must be a boolean or UNKNOWN`);
    }
    if (!isUnknownOrString(source.metadata.remoteUrl) || (typeof source.metadata.remoteUrl === 'string' && containsSecretLikeValue(source.metadata.remoteUrl))) {
      issues.push(`${path}.metadata.remoteUrl must be a safe string or UNKNOWN`);
    }
    if (!isUnknownOrString(source.metadata.latestLocalCommitDate) || (typeof source.metadata.latestLocalCommitDate === 'string' && source.metadata.latestLocalCommitDate !== UNKNOWN && !SAFE_DATE.test(source.metadata.latestLocalCommitDate))) {
      issues.push(`${path}.metadata.latestLocalCommitDate must be an ISO date or UNKNOWN`);
    }
    if (source.metadata.remoteUrl !== UNKNOWN && typeof source.metadata.remoteUrl === 'string' && sanitizeRemoteUrl(source.metadata.remoteUrl) === null) {
      issues.push(`${path}.metadata.remoteUrl must not contain userinfo, query, or fragment`);
    }
  }
  return issues.length === 0;
}

function validateSourceBoundary(source: unknown, path: string, boundary: InventoryBoundary | null, issues: string[]): void {
  if (!boundary || !isRecord(source)) return;
  const typedSource = source as unknown as InventorySource;
  if (!sourceHasReviewedRoot(typedSource, boundary)) issues.push(`${path}.sourceRoot is not an approved provenance root`);
  if (!sourceIsInsideBoundary(typedSource, boundary)) issues.push(`${path}.safePathOrIdentifier is outside its approved Windows boundary`);
  if (typedSource.host === 'FEDORA' && typedSource.sourceType !== 'MANUAL_PROVENANCE') issues.push(`${path}.host FEDORA requires MANUAL_PROVENANCE`);
}

function validateProject(project: unknown, path: string, issues: string[], keyField: 'projectKey' | 'candidateKey', boundary: InventoryBoundary | null): boolean {
  if (!isRecord(project)) {
    issues.push(`${path} must be an object`);
    return false;
  }
  if (typeof project[keyField] !== 'string' || !SAFE_KEY.test(project[keyField] as string)) issues.push(`${path}.${keyField} is invalid`);
  for (const field of ['name', 'runtimeState', 'purpose']) {
    if (typeof project[field] !== 'string' || project[field].length === 0) issues.push(`${path}.${field} is required`);
    else if (project[field].length > 4096 || containsSecretLikeValue(project[field])) issues.push(`${path}.${field} is not a safe description`);
  }
  if (!['AIBRY', 'AIBRY_LABS', UNKNOWN].includes(String(project.engine))) issues.push(`${path}.engine is invalid`);
  if (!['FLAGSHIP', 'REVENUE', 'SUPPORTING', 'MAINTENANCE', 'FROZEN', UNKNOWN].includes(String(project.classification))) issues.push(`${path}.classification is invalid`);
  if (!['ACTIVE', 'MAINTENANCE', 'FROZEN', 'ARCHIVED', UNKNOWN].includes(String(project.status))) issues.push(`${path}.status is invalid`);
  if (typeof project.purpose !== 'string' || project.purpose.length === 0) issues.push(`${path}.purpose is required`);
  if (!Array.isArray(project.links) || project.links.some((item) => typeof item !== 'string' || item.length > 2048 || containsSecretLikeValue(item))) issues.push(`${path}.links is invalid`);
  if (project.monthlyCost !== null && (typeof project.monthlyCost !== 'number' || !Number.isFinite(project.monthlyCost))) issues.push(`${path}.monthlyCost is invalid`);
  if (!Array.isArray(project.duplicateSignals) || project.duplicateSignals.some((item) => typeof item !== 'string')) issues.push(`${path}.duplicateSignals is invalid`);
  if (!isReviewState(project.reviewState)) issues.push(`${path}.reviewState is invalid`);
  if (!Array.isArray(project.outcomes) || project.outcomes.length !== 0) issues.push(`${path}.outcomes must be empty`);
  if (project.workstreamNote !== undefined && (typeof project.workstreamNote !== 'string' || project.workstreamNote.length > 4096 || containsSecretLikeValue(project.workstreamNote))) issues.push(`${path}.workstreamNote is invalid`);
  if (!Array.isArray(project.sources)) {
    issues.push(`${path}.sources is required`);
  } else {
    project.sources.forEach((source, index) => {
      validateSource(source, `${path}.sources[${index}]`, issues);
      validateSourceBoundary(source, `${path}.sources[${index}]`, boundary, issues);
    });
  }
  return issues.length === 0;
}

export function validateManifest(value: unknown): InventoryManifest {
  const issues: string[] = [];
  if (!isRecord(value)) throw new ManifestValidationError(['manifest must be an object']);
  if (typeof value.manifestVersion !== 'string' || value.manifestVersion.length === 0) issues.push('manifestVersion is required');
  if (!['PROPOSED', 'APPROVED'].includes(String(value.artifactStatus))) issues.push('artifactStatus is invalid');
  for (const field of ['generatedAt', 'reviewedAt']) {
    if (typeof value[field] !== 'string' || value[field].length === 0) issues.push(`${field} is required`);
  }
  if (!isRecord(value.discoveryBoundary)) issues.push('discoveryBoundary is required');
  const boundary = isRecord(value.discoveryBoundary) ? value.discoveryBoundary as unknown as InventoryBoundary : null;
  if (!Array.isArray(value.canonicalProjects)) issues.push('canonicalProjects is required');
  else value.canonicalProjects.forEach((project, index) => validateProject(project, `canonicalProjects[${index}]`, issues, 'projectKey', boundary));
  if (!Array.isArray(value.reviewCandidates)) issues.push('reviewCandidates is required');
  else value.reviewCandidates.forEach((candidate, index) => {
    validateProject(candidate, `reviewCandidates[${index}]`, issues, 'candidateKey', boundary);
    if (isRecord(candidate) && !['UNKNOWN', 'REVIEW_REQUIRED'].includes(String(candidate.candidateDisposition))) issues.push(`reviewCandidates[${index}].candidateDisposition is invalid`);
  });
  if (!Array.isArray(value.excludedCandidates)) issues.push('excludedCandidates is required');
  if (!Array.isArray(value.importGuards)) issues.push('importGuards is required');
  if (!Array.isArray(value.outcomes) || value.outcomes.length !== 0) issues.push('outcomes must be empty');
  walkForSensitiveKeys(value, '$', issues);
  walkForSensitiveValues(value, '$', issues);
  if (Array.isArray(value.canonicalProjects)) {
    const sourceOwners = new Map<string, string>();
    value.canonicalProjects.forEach((project, index) => {
      if (!isRecord(project) || !Array.isArray(project.sources)) return;
      project.sources.forEach((source) => {
        if (!isRecord(source) || typeof source.sourceKey !== 'string') return;
        const owner = `canonicalProjects[${index}]`;
        const previous = sourceOwners.get(source.sourceKey);
        if (previous) issues.push(`sourceKey ${source.sourceKey} is duplicated across canonical source records`);
        sourceOwners.set(source.sourceKey, owner);
      });
    });
  }
  if (issues.length > 0) throw new ManifestValidationError([...new Set(issues)]);
  return value as unknown as InventoryManifest;
}

export function sanitizeRemoteUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    if (!['http:', 'https:', 'ssh:'].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password || parsed.search || parsed.hash) return null;
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function assertApprovedReview(manifest: InventoryManifest): void {
  const pending = manifest.canonicalProjects.filter((item) => item.reviewState !== 'APPROVED');
  const pendingSources = manifest.canonicalProjects.flatMap((item) => item.sources).filter((source) => source.reviewState !== 'APPROVED');
  if (pending.length || pendingSources.length) throw new ManifestValidationError(['all imported projects and sources must be APPROVED']);
}

/**
 * The immutable artifact is authorized externally. PENDING is valid here: it
 * records that the JSON was not self-approved. An explicit rejection remains a
 * fail-closed record-level decision even when the artifact has external approval.
 */
export function assertCanonicalImportable(manifest: InventoryManifest): void {
  const rejected = manifest.canonicalProjects.some((project) => project.reviewState === 'REJECTED')
    || manifest.canonicalProjects.some((project) => project.sources.some((source) => source.reviewState === 'REJECTED'));
  if (rejected) throw new ManifestValidationError(['rejected canonical projects or sources cannot be imported']);
}

export async function readAndValidateManifest(path: string): Promise<{ bytes: Buffer; hash: string; manifest: InventoryManifest }> {
  const bytes = await readFile(path);
  const hash = createHash('sha256').update(bytes).digest('hex').toUpperCase();
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new ManifestValidationError(['manifest is not valid JSON']);
  }
  return { bytes, hash, manifest: validateManifest(parsed) };
}

export function assertExactManifestHash(actual: string, expected: string): void {
  if (!/^[A-Fa-f0-9]{64}$/.test(expected) || actual.toUpperCase() !== expected.toUpperCase()) {
    throw new ManifestIntegrityError('Manifest SHA-256 does not match the approved artifact.');
  }
}
