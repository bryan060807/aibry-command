import type { Outcome, PortfolioProject, PortfolioRepository, Project } from './types.js';
import { OutcomePolicyError } from './types.js';

const copy = <T>(value: T): T => structuredClone(value);

export class InMemoryPortfolioRepository implements PortfolioRepository {
  readonly dataStatus = 'REPRESENTATIVE_SEED_DATA_ONLY' as const;
  private readonly projects: Map<string, Project>;
  private readonly outcomes: Map<string, Outcome>;

  constructor(projects: Project[] = [], outcomes: Outcome[] = []) {
    this.projects = new Map(projects.map((project) => [project.id, copy(project)]));
    this.outcomes = new Map(outcomes.map((outcome) => [outcome.id, copy(outcome)]));
  }

  async listPortfolio(): Promise<PortfolioProject[]> {
    return [...this.projects.values()].map((project) => ({
      ...copy(project),
      outcomes: [...this.outcomes.values()]
        .filter((outcome) => outcome.projectId === project.id)
        .sort((left, right) => left.priority - right.priority)
        .map(copy),
    }));
  }

  async activateOutcome(outcomeId: string): Promise<Outcome> {
    const outcome = this.outcomes.get(outcomeId);
    if (!outcome) {
      throw new OutcomePolicyError('OUTCOME_NOT_FOUND', 'Outcome was not found.');
    }

    const project = this.projects.get(outcome.projectId);
    if (!project) {
      throw new OutcomePolicyError('OUTCOME_NOT_FOUND', 'Outcome project was not found.');
    }
    if (project.status === 'FROZEN') {
      throw new OutcomePolicyError('PROJECT_FROZEN', 'Frozen projects cannot activate outcomes.');
    }
    if (outcome.status === 'ACTIVE') return copy(outcome);
    if (!['PLANNED', 'BLOCKED'].includes(outcome.status)) {
      throw new OutcomePolicyError('OUTCOME_NOT_ACTIVATABLE', 'Only planned or blocked outcomes can activate.');
    }

    const activeCount = [...this.outcomes.values()].filter((item) => item.status === 'ACTIVE').length;
    if (activeCount >= 3) {
      throw new OutcomePolicyError('ACTIVE_OUTCOME_LIMIT', 'No more than three active outcomes are allowed.');
    }

    const activated = { ...outcome, status: 'ACTIVE' as const };
    this.outcomes.set(outcomeId, activated);
    return copy(activated);
  }
}
