import type { Project, Outcome } from '../../server/portfolio/types.js';

/** Representative, non-secret, seed-only data. No external inventory source. */
export const SEED_DATA_STATUS = 'REPRESENTATIVE_SEED_DATA_ONLY' as const;

export const seedProjects: Project[] = [
  {
    id: 'project-asos-kernel',
    name: 'ASOS Kernel',
    engine: 'AIBRY_LABS',
    classification: 'FLAGSHIP',
    status: 'ACTIVE',
    purpose: 'Flagship coordination and operating-system proof for AIBRY Labs.',
    links: [],
    monthlyCost: 0,
  },
  {
    id: 'project-trackmaster',
    name: 'TrackMaster',
    engine: 'AIBRY_LABS',
    classification: 'REVENUE',
    status: 'ACTIVE',
    purpose: 'Product work for a revenue-oriented AIBRY Labs tool.',
    links: [],
    monthlyCost: 0,
  },
  {
    id: 'project-aibry-command',
    name: 'AIBRY Command',
    engine: 'AIBRY_LABS',
    classification: 'SUPPORTING',
    status: 'ACTIVE',
    purpose: 'Private operating control plane for creative and technical work.',
    links: [],
    monthlyCost: 0,
  },
  {
    id: 'project-garage-assist',
    name: 'Garage Assist',
    engine: 'AIBRY_LABS',
    classification: 'MAINTENANCE',
    status: 'MAINTENANCE',
    purpose: 'Existing vehicle diagnostics product requiring bounded maintenance.',
    links: [],
    monthlyCost: 0,
  },
  {
    id: 'project-archived-experiment',
    name: 'Archived Experiment',
    engine: 'AIBRY',
    classification: 'FROZEN',
    status: 'FROZEN',
    purpose: 'Representative frozen project retained for policy visibility.',
    links: [],
    monthlyCost: 0,
  },
];

export const seedOutcomes: Outcome[] = [
  {
    id: 'outcome-asos-proof',
    projectId: 'project-asos-kernel',
    title: 'Demonstrate one verified operating loop',
    successMeasure: 'A real internal workflow reaches verified completion.',
    deadline: '2026-10-14T23:59:59.000Z',
    status: 'PLANNED',
    priority: 1,
  },
  {
    id: 'outcome-trackmaster-oidc-seam',
    projectId: 'project-trackmaster',
    title: 'Keep the authorization boundary explicit',
    successMeasure: 'A future AIBRY ID OIDC seam is documented without a live connection.',
    deadline: '2026-09-19T23:59:59.000Z',
    status: 'PLANNED',
    priority: 2,
  },
  {
    id: 'outcome-command-slice',
    projectId: 'project-aibry-command',
    title: 'Ship the bounded portfolio slice',
    successMeasure: 'Portfolio data and the three-outcome policy pass focused tests.',
    deadline: '2026-09-12T23:59:59.000Z',
    status: 'PLANNED',
    priority: 1,
  },
];
