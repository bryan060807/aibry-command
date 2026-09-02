import { Pool } from 'pg';
import { createApp } from './app.js';
import { denyByDefault } from './auth/authorization.js';
import { logger } from './logging.js';
import { InMemoryPortfolioRepository } from './portfolio/memory-repository.js';
import { createPgRepository } from './portfolio/pg-repository.js';
import { seedOutcomes, seedProjects } from '../db/seed/portfolio.js';

const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !databaseUrl) {
  logger.error('server.configuration_error');
  throw new Error('DATABASE_URL is required in production.');
}

const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : undefined;
const repository = pool ? createPgRepository(pool) : new InMemoryPortfolioRepository(seedProjects, seedOutcomes);
const localSeedPreview = process.env.AIBRY_COMMAND_LOCAL_PREVIEW === 'true' && !isProduction && !databaseUrl;
const authorizer = localSeedPreview ? () => true : denyByDefault;
logger.info('server.starting', { repository: pool ? 'postgresql' : 'seed-memory' });

const port = Number(process.env.PORT ?? 4012);
const host = localSeedPreview ? '127.0.0.1' : (process.env.HOST ?? '127.0.0.1');
createApp({ repository, authorizer }).listen(port, host, () => logger.info('server.listening', { port }));
