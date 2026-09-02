import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';
import { seedOutcomes, seedProjects } from '../../db/seed/portfolio.js';
import { createApp } from '../../server/app.js';
import type { Authorizer } from '../../server/auth/authorization.js';
import { InMemoryPortfolioRepository } from '../../server/portfolio/memory-repository.js';
import type { PortfolioRepository } from '../../server/portfolio/types.js';

interface TestServerOptions {
  repository?: PortfolioRepository;
  authorizer?: Authorizer;
  useDefaultAuthorization?: boolean;
}

async function withServer(run: (baseUrl: string) => Promise<void>, options: TestServerOptions = {}): Promise<void> {
  const repository = options.repository ?? new InMemoryPortfolioRepository(seedProjects, seedOutcomes);
  const app = createApp({
    repository,
    authorizer: options.useDefaultAuthorization ? undefined : options.authorizer ?? (() => true),
    serveClient: false,
    logger: { info() {}, warn() {}, error() {} },
  });
  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind to a port.');
  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('GET portfolio returns repository data and seed status', async () => {
  const authorizationCalls: string[] = [];
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/portfolio`);
    assert.equal(response.status, 200);
    const body = await response.json() as { dataStatus: string; projects: unknown[] };
    assert.equal(body.dataStatus, 'REPRESENTATIVE_SEED_DATA_ONLY');
    assert.equal(body.projects.length, 5);
  }, {
    authorizer: (context) => {
      authorizationCalls.push(`${context.operation}:${context.method}:${context.path}`);
      return true;
    },
  });
  assert.deepEqual(authorizationCalls, ['portfolio.read:GET:/api/portfolio']);
});

test('activation succeeds, then rejects the fourth active outcome', async () => {
  await withServer(async (baseUrl) => {
    const first = await fetch(`${baseUrl}/api/outcomes/outcome-command-slice/activate`, { method: 'POST' });
    assert.equal(first.status, 200);
    const fourth = await fetch(`${baseUrl}/api/outcomes/outcome-command-slice/activate`, { method: 'POST' });
    assert.equal(fourth.status, 200, 'repeated activation of the same active outcome is idempotent');

    const fourthOutcome = { ...seedOutcomes[0], id: 'outcome-fourth', status: 'PLANNED' as const };
    const repository = new InMemoryPortfolioRepository(seedProjects, [
      ...seedOutcomes.map((outcome) => ({ ...outcome, status: 'ACTIVE' as const })),
      fourthOutcome,
    ]);
    await withServer(async (limitedBaseUrl) => {
      const rejected = await fetch(`${limitedBaseUrl}/api/outcomes/outcome-fourth/activate`, { method: 'POST' });
      assert.equal(rejected.status, 409);
      assert.equal((await rejected.json() as { error: string }).error, 'ACTIVE_OUTCOME_LIMIT');
    }, { repository });
  });
});

test('default authorization fails closed', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/portfolio`);
    assert.equal(response.status, 401);
  }, { useDefaultAuthorization: true });
});

test('activation rejects invalid and unknown outcome ids', async () => {
  await withServer(async (baseUrl) => {
    const invalid = await fetch(`${baseUrl}/api/outcomes/not%20an%20id/activate`, { method: 'POST' });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.json() as { error: string }).error, 'invalid_outcome_id');

    const unknown = await fetch(`${baseUrl}/api/outcomes/outcome-missing/activate`, { method: 'POST' });
    assert.equal(unknown.status, 404);
    assert.equal((await unknown.json() as { error: string }).error, 'OUTCOME_NOT_FOUND');
  });
});

test('activation rejects an outcome belonging to a frozen project', async () => {
  const frozenOutcome = { ...seedOutcomes[0], id: 'outcome-frozen-project', projectId: 'project-archived-experiment' };
  const repository = new InMemoryPortfolioRepository(seedProjects, [...seedOutcomes, frozenOutcome]);
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/outcomes/outcome-frozen-project/activate`, { method: 'POST' });
    assert.equal(response.status, 422);
    assert.equal((await response.json() as { error: string }).error, 'PROJECT_FROZEN');
  }, { repository });
});
