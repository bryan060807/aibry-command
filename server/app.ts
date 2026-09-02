import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { denyByDefault, requireAuthorization, type Authorizer } from './auth/authorization.js';
import { logger as defaultLogger, type Logger } from './logging.js';
import type { PortfolioRepository } from './portfolio/types.js';
import { OutcomePolicyError } from './portfolio/types.js';

export interface AppOptions {
  repository: PortfolioRepository;
  authorizer?: Authorizer;
  logger?: Logger;
  serveClient?: boolean;
}

export function createApp({ repository, authorizer = denyByDefault, logger = defaultLogger, serveClient = true }: AppOptions): Express {
  const app = express();
  app.use(express.json({ limit: '8kb' }));
  app.use((request, response, next) => {
    const started = Date.now();
    response.on('finish', () => logger.info('http.request', {
      method: request.method,
      path: request.path,
      status: response.statusCode,
      durationMs: Date.now() - started,
    }));
    next();
  });

  app.get('/api/portfolio', requireAuthorization('portfolio.read', authorizer, logger), async (_request, response, next) => {
    try {
      response.json({ dataStatus: repository.dataStatus, projects: await repository.listPortfolio() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/outcomes/:id/activate', requireAuthorization('outcome.activate', authorizer, logger), async (request, response, next) => {
    const rawOutcomeId = request.params.id;
    const outcomeId = typeof rawOutcomeId === 'string' ? rawOutcomeId : '';
    if (!/^[a-z0-9-]{1,100}$/.test(outcomeId)) {
      response.status(400).json({ error: 'invalid_outcome_id' });
      return;
    }
    try {
      response.status(200).json({ outcome: await repository.activateOutcome(outcomeId) });
    } catch (error) {
      if (error instanceof OutcomePolicyError) {
        const status = error.code === 'OUTCOME_NOT_FOUND' ? 404 : error.code === 'ACTIVE_OUTCOME_LIMIT' ? 409 : 422;
        response.status(status).json({ error: error.code, message: error.message });
        return;
      }
      next(error);
    }
  });

  if (serveClient) {
    const clientPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist/client');
    app.use(express.static(clientPath));
    app.get('/{*splat}', (_request, response) => response.sendFile(path.join(clientPath, 'index.html')));
  }

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    logger.error('http.error');
    response.status(500).json({ error: 'internal_server_error' });
  });
  return app;
}
