import assert from 'node:assert/strict';
import test from 'node:test';
import { seedOutcomes, seedProjects } from '../../db/seed/portfolio.js';
import { InMemoryPortfolioRepository } from '../../server/portfolio/memory-repository.js';

test('activates a planned outcome when fewer than three are active', async () => {
  const repository = new InMemoryPortfolioRepository(seedProjects, seedOutcomes);
  const activated = await repository.activateOutcome('outcome-command-slice');
  assert.equal(activated.status, 'ACTIVE');
});

test('rejects activation when three outcomes are already active', async () => {
  const fourthOutcome = { ...seedOutcomes[0], id: 'outcome-fourth', status: 'PLANNED' as const };
  const outcomes = [
    ...seedOutcomes.map((outcome) => ({ ...outcome, status: 'ACTIVE' as const })),
    fourthOutcome,
  ];
  const repository = new InMemoryPortfolioRepository(seedProjects, outcomes);
  await assert.rejects(
    repository.activateOutcome('outcome-fourth'),
    (error: Error & { code?: string }) => error.code === 'ACTIVE_OUTCOME_LIMIT',
  );
});

test('repeated activation of an active outcome is idempotent', async () => {
  const repository = new InMemoryPortfolioRepository(seedProjects, seedOutcomes);
  const first = await repository.activateOutcome('outcome-command-slice');
  const second = await repository.activateOutcome('outcome-command-slice');
  assert.equal(first.status, 'ACTIVE');
  assert.deepEqual(second, first);
});

test('rejects activation for a frozen project', async () => {
  const repository = new InMemoryPortfolioRepository(seedProjects, [
    { ...seedOutcomes[0], projectId: 'project-archived-experiment' },
  ]);
  await assert.rejects(
    repository.activateOutcome(seedOutcomes[0].id),
    (error: Error & { code?: string }) => error.code === 'PROJECT_FROZEN',
  );
});
