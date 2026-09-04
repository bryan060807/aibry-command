import type { Classification, Engine, ProjectStatus } from '../portfolio/types.js';

export const REVIEW_STATES = ['PENDING', 'APPROVED', 'REJECTED'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export type InventoryUnknown = 'UNKNOWN';
export type InventoryEngine = Engine | InventoryUnknown;
export type InventoryClassification = Classification | InventoryUnknown;
export type InventoryProjectStatus = ProjectStatus | InventoryUnknown;
export type InventoryArtifactStatus = 'PROPOSED' | 'APPROVED';
export type InventoryHost = 'WINDOWS' | 'FEDORA' | 'UNKNOWN';
export type InventorySourceType = 'REPOSITORY' | 'MANUAL_PROVENANCE' | 'REFERENCE';
export type InventorySourceRole =
  | 'PRIMARY_REPO'
  | 'UI_REPO'
  | 'API_REPO'
  | 'BRIDGE'
  | 'LEGACY'
  | 'RUNTIME'
  | 'DATA_DEPENDENCY'
  | 'SUPPORT'
  | 'REFERENCE';

export interface InventorySourceMetadata {
  packageName: string | InventoryUnknown;
  scripts: string[] | InventoryUnknown;
  gitPresent: boolean | InventoryUnknown;
  branch: string | InventoryUnknown;
  remoteUrl: string | InventoryUnknown;
  latestLocalCommitDate: string | InventoryUnknown;
  frameworkRuntime: string | InventoryUnknown;
  readmeDescription: string | InventoryUnknown;
  deploymentConfigPresent: boolean | InventoryUnknown;
  testsPresent: boolean | InventoryUnknown;
}

export interface InventorySource {
  sourceKey: string;
  sourceType: InventorySourceType;
  sourceRole: InventorySourceRole;
  host: InventoryHost;
  safePathOrIdentifier: string;
  sourceRoot: string;
  metadata: InventorySourceMetadata;
  duplicateSignals: string[];
  observedAt: string;
  manifestProvenance: string;
  reviewState: ReviewState;
}

/** Input compatibility for untyped synthetic manifest fixtures; file manifests
 * are narrowed by validateManifest before any import uses these records. */
export type InventorySourceInput = InventorySource | Record<string, any>;

export interface InventoryProject {
  projectKey: string;
  name: string;
  engine: InventoryEngine;
  classification: InventoryClassification;
  status: InventoryProjectStatus;
  runtimeState: string | InventoryUnknown;
  purpose: string | InventoryUnknown;
  links: string[];
  monthlyCost: number | null;
  duplicateSignals: string[];
  reviewState: ReviewState;
  outcomes: [];
  sources: InventorySourceInput[];
  workstreamNote?: string;
}

export interface InventoryCandidate extends Omit<InventoryProject, 'projectKey'> {
  /** Legacy fixture compatibility only; validation uses candidateKey. */
  projectKey?: string;
  candidateKey: string;
  candidateDisposition: 'UNKNOWN' | 'REVIEW_REQUIRED';
}

export interface InventoryExcludedCandidate {
  name: string;
  path: string;
  reason: string;
}

export interface InventoryRoot {
  rootKey: string;
  path: string;
  scanMode: string;
}

export interface InventoryBoundary {
  approvedRoots: InventoryRoot[];
  manualSourceRoots: InventoryRoot[];
  exclusions: string[];
  executionPolicy: string;
}

export interface InventorySummary {
  canonicalProjectCount: number;
  sourceRecordCount: number;
  unknownCandidateCount: number;
  reviewRequiredCandidateCount: number;
  outcomeCount: number;
}

export interface InventoryManifest {
  manifestVersion: string;
  artifactStatus: InventoryArtifactStatus;
  generatedAt: string;
  reviewedAt: string;
  discoveryBoundary: InventoryBoundary;
  summary: InventorySummary;
  canonicalProjects: InventoryProject[];
  reviewCandidates: InventoryCandidate[];
  excludedCandidates: InventoryExcludedCandidate[];
  importGuards: string[];
  outcomes: [];
}

export interface ScannedSource extends InventorySource {
  sourcePath: string;
}

export interface ScannedCandidate {
  candidateKey: string;
  name: string;
  source: ScannedSource;
  duplicateSignals: string[];
}
