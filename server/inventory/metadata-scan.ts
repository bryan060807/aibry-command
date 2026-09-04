import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import { sanitizeRemoteUrl } from './manifest-review.js';
import type { InventorySourceMetadata, ScannedCandidate, ScannedSource } from './types.js';

const EXCLUDED_NAMES = new Set([
  'node_modules', 'dist', 'build', 'coverage', 'output', 'cache', 'tmp', 'temp', '.git',
  'backups', 'backup', 'database-dumps', 'db-dumps', 'media', 'binary', 'music-vault', 'shared_folder',
]);
const SENSITIVE_NAME = /(^|[._-])(env|credentials?|secrets?|tokens?|keys?|passwords?|sessions?|invites?|captures?)($|[._-])/i;
const PACKAGE_LIMIT = 64 * 1024;
const README_LIMIT = 4096;
export const APPROVED_WINDOWS_DISCOVERY_ROOT = 'C:\\Users\\bryan\\aibry\\projects';
const BROAD_AIBRY_ROOT = 'c:\\aibry';
const SECRET_LIKE_VALUE = /(password|passwd|secret|token|api[_ -]?key|private[_ -]?key|bearer)\s*[:=]/i;
const FORBIDDEN_ROOTS = ['c:\\aibry\\music-vault', 'c:\\aibry\\shared_folder'];
const FORBIDDEN_SEGMENTS = new Set([
  '.env', 'credentials', 'credential', 'secrets', 'secret', 'tokens', 'token', 'keys', 'key', 'passwords', 'password',
  'sessions', 'session', 'invites', 'invite', 'node_modules', 'vendor', 'dist', 'build', 'coverage', 'output', 'cache',
  'tmp', 'temp', 'backups', 'backup', 'database-dumps', 'db-dumps', 'media', 'captures', 'camera-captures', 'music-vault',
  'shared_folder', 'genealogy', 'person-data', 'personal-data',
]);

export class InventoryBoundaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InventoryBoundaryError';
  }
}

function normalizedForComparison(value: string): string {
  return path.normalize(value).replace(/[\\/]+$/, '').toLowerCase();
}

export async function resolveContainedPath(candidatePath: string, approvedRoot: string): Promise<string> {
  const root = await realpath(approvedRoot).catch(() => { throw new InventoryBoundaryError('Approved root does not exist.'); });
  const candidate = await realpath(candidatePath).catch(() => { throw new InventoryBoundaryError('Candidate path does not exist.'); });
  const relative = path.relative(root, candidate);
  const outside = relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);
  if (outside || !normalizedForComparison(candidate).startsWith(`${normalizedForComparison(root)}${path.sep}`) && normalizedForComparison(candidate) !== normalizedForComparison(root)) {
    throw new InventoryBoundaryError('Resolved candidate path is outside the approved boundary.');
  }
  return candidate;
}

function isExcludedName(name: string): boolean {
  return EXCLUDED_NAMES.has(name.toLowerCase()) || SENSITIVE_NAME.test(name) || name.toLowerCase().startsWith('.env');
}

function isBroadAibryRoot(value: string): boolean {
  return value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase() === BROAD_AIBRY_ROOT;
}

function containsForbiddenPath(value: string): boolean {
  const normalized = value.replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase();
  return FORBIDDEN_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}\\`))
    || normalized.split('\\').some((segment) => FORBIDDEN_SEGMENTS.has(segment) || segment.startsWith('.env'));
}

function safeMetadataString(value: string | undefined, limit: number): string | 'UNKNOWN' {
  return value && value.length <= limit && !SECRET_LIKE_VALUE.test(value) ? value : 'UNKNOWN';
}

async function safeReadText(filePath: string, limit: number): Promise<string | null> {
  try {
    const info = await lstat(filePath);
    if (!info.isFile() || info.size > limit) return null;
    return (await readFile(filePath, 'utf8')).slice(0, limit);
  } catch {
    return null;
  }
}

function frameworkHint(packageJson: Record<string, unknown>): string | 'UNKNOWN' {
  const dependencies = { ...(packageJson.dependencies as Record<string, unknown> | undefined), ...(packageJson.devDependencies as Record<string, unknown> | undefined) };
  const names = Object.keys(dependencies);
  const hints = [
    ['next', 'Next.js'], ['react', 'React'], ['vite', 'Vite'], ['express', 'Express'], ['@angular/core', 'Angular'],
  ] as const;
  const found = hints.filter(([name]) => names.includes(name)).map(([, label]) => label);
  return found.length ? found.join('/') : 'UNKNOWN';
}

function hasAnyEntry(entries: string[], names: string[]): boolean {
  const lower = new Set(entries.map((entry) => entry.toLowerCase()));
  return names.some((name) => lower.has(name));
}

async function readGitMetadata(projectPath: string): Promise<Pick<InventorySourceMetadata, 'gitPresent' | 'branch' | 'remoteUrl' | 'latestLocalCommitDate'>> {
  const gitPath = path.join(projectPath, '.git');
  try {
    const gitInfo = await lstat(gitPath);
    if (!gitInfo.isDirectory() && !gitInfo.isFile()) return { gitPresent: false, branch: 'UNKNOWN', remoteUrl: 'UNKNOWN', latestLocalCommitDate: 'UNKNOWN' };
    const head = await safeReadText(path.join(gitPath, 'HEAD'), 1024);
    const config = await safeReadText(path.join(gitPath, 'config'), 16 * 1024);
    const branch = head?.match(/^ref:\s+refs\/heads\/(.+)$/m)?.[1]?.trim() ?? 'UNKNOWN';
    const remote = config?.match(/url\s*=\s*(\S+)/)?.[1];
    return { gitPresent: true, branch, remoteUrl: remote ? (sanitizeRemoteUrl(remote) ?? 'UNKNOWN') : 'UNKNOWN', latestLocalCommitDate: 'UNKNOWN' };
  } catch {
    return { gitPresent: false, branch: 'UNKNOWN', remoteUrl: 'UNKNOWN', latestLocalCommitDate: 'UNKNOWN' };
  }
}

export async function scanSelectedWindowsPath(selectedPath: string, approvedRoot: string): Promise<ScannedCandidate> {
  const projectPath = await resolveContainedPath(selectedPath, approvedRoot);
  const projectName = path.basename(projectPath);
  if (projectPath === await realpath(approvedRoot) || isExcludedName(projectName) || containsForbiddenPath(projectPath)) throw new InventoryBoundaryError('Candidate is in an excluded boundary.');
  const entries = (await readdir(projectPath, { withFileTypes: true })).filter((entry) => !isExcludedName(entry.name));
  const packageText = await safeReadText(path.join(projectPath, 'package.json'), PACKAGE_LIMIT);
  let packageJson: Record<string, unknown> = {};
  if (packageText) {
    try {
      const parsed = JSON.parse(packageText) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) packageJson = parsed as Record<string, unknown>;
    } catch {
      // Invalid package metadata is retained as UNKNOWN; scanning never executes it.
    }
  }
  const git = await readGitMetadata(projectPath);
  const readme = await safeReadText(path.join(projectPath, 'README.md'), README_LIMIT);
  const metadata: InventorySourceMetadata = {
    packageName: safeMetadataString(typeof packageJson.name === 'string' ? packageJson.name : undefined, 240),
    scripts: packageJson.scripts && typeof packageJson.scripts === 'object' && !Array.isArray(packageJson.scripts) && !Object.keys(packageJson.scripts as object).some((name) => SECRET_LIKE_VALUE.test(name)) ? Object.keys(packageJson.scripts as object) : 'UNKNOWN',
    gitPresent: git.gitPresent,
    branch: safeMetadataString(git.branch, 240),
    remoteUrl: git.remoteUrl,
    latestLocalCommitDate: git.latestLocalCommitDate,
    frameworkRuntime: safeMetadataString(frameworkHint(packageJson), 240),
    readmeDescription: readme && !SECRET_LIKE_VALUE.test(readme) ? readme.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? 'UNKNOWN' : 'UNKNOWN',
    deploymentConfigPresent: hasAnyEntry(entries.map((entry) => entry.name), ['dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'vercel.json', 'fly.toml']),
    testsPresent: entries.some((entry) => /^(test|tests|__tests__)$/i.test(entry.name)),
  };
  const sourceKey = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100);
  const source: ScannedSource = {
    sourceKey: sourceKey || 'candidate', sourceType: 'REPOSITORY', sourceRole: 'PRIMARY_REPO', host: 'WINDOWS',
    safePathOrIdentifier: projectPath, sourceRoot: await realpath(approvedRoot), metadata, duplicateSignals: [],
    observedAt: new Date().toISOString(), manifestProvenance: 'metadata-scan', reviewState: 'PENDING', sourcePath: projectPath,
  };
  return { candidateKey: sourceKey, name: safeMetadataString(typeof packageJson.name === 'string' ? packageJson.name : projectName, 240), source, duplicateSignals: [] };
}

export async function scanApprovedWindowsRoot(approvedRoot: string = APPROVED_WINDOWS_DISCOVERY_ROOT): Promise<ScannedCandidate[]> {
  if (isBroadAibryRoot(approvedRoot)) throw new InventoryBoundaryError('C:\\AIBRY cannot be used as a recursive discovery root.');
  if (normalizedForComparison(approvedRoot) !== normalizedForComparison(APPROVED_WINDOWS_DISCOVERY_ROOT)) {
    throw new InventoryBoundaryError('Only the approved Windows projects root may be recursively scanned.');
  }
  const root = await realpath(approvedRoot).catch(() => { throw new InventoryBoundaryError('Approved root does not exist.'); });
  const entries = await readdir(root, { withFileTypes: true });
  const candidates: ScannedCandidate[] = [];
  const seen = new Map<string, string>();
  for (const entry of entries) {
    if (!entry.isDirectory() || isExcludedName(entry.name)) continue;
    const selected = await resolveContainedPath(path.join(root, entry.name), root);
    const normalized = normalizedForComparison(selected);
    if (seen.has(normalized)) {
      candidates.push({ ...(await scanSelectedWindowsPath(selected, root)), duplicateSignals: [`Case-insensitive path duplicate of ${seen.get(normalized)}`] });
      continue;
    }
    seen.set(normalized, selected);
    candidates.push(await scanSelectedWindowsPath(selected, root));
  }
  return candidates;
}
