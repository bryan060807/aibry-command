export type Engine = 'AIBRY' | 'AIBRY_LABS';
export type Classification = 'FLAGSHIP' | 'REVENUE' | 'SUPPORTING' | 'MAINTENANCE' | 'FROZEN';
export type ProjectStatus = 'ACTIVE' | 'MAINTENANCE' | 'FROZEN' | 'ARCHIVED';
export type OutcomeStatus = 'PLANNED' | 'ACTIVE' | 'BLOCKED' | 'COMPLETED' | 'ARCHIVED';

export interface Project {
  id: string;
  name: string;
  engine: Engine;
  classification: Classification;
  status: ProjectStatus;
  purpose: string;
  links: string[];
  monthlyCost: number | null;
}

export interface Outcome {
  id: string;
  projectId: string;
  title: string;
  successMeasure: string;
  deadline: string | null;
  status: OutcomeStatus;
  priority: number;
}

export interface PortfolioProject extends Project {
  outcomes: Outcome[];
}

export interface PortfolioRepository {
  readonly dataStatus: 'REPRESENTATIVE_SEED_DATA_ONLY' | 'POSTGRESQL_DATA';
  listPortfolio(): Promise<PortfolioProject[]>;
  activateOutcome(outcomeId: string): Promise<Outcome>;
}

export type ActivationErrorCode =
  | 'OUTCOME_NOT_FOUND'
  | 'OUTCOME_NOT_ACTIVATABLE'
  | 'PROJECT_FROZEN'
  | 'ACTIVE_OUTCOME_LIMIT';

export class OutcomePolicyError extends Error {
  constructor(public readonly code: ActivationErrorCode, message: string) {
    super(message);
    this.name = 'OutcomePolicyError';
  }
}
