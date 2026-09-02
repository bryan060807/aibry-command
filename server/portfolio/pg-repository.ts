import type { Pool, PoolClient } from 'pg';
import type { Outcome, PortfolioProject, PortfolioRepository, Project } from './types.js';
import { OutcomePolicyError } from './types.js';

type ProjectRow = Project & { monthly_cost: string | number | null };
type OutcomeRow = Outcome & { project_id: string; success_measure: string };

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    engine: row.engine,
    classification: row.classification,
    status: row.status,
    purpose: row.purpose,
    links: Array.isArray(row.links) ? row.links : [],
    monthlyCost: row.monthly_cost === null ? null : Number(row.monthly_cost),
  };
}

function mapOutcome(row: OutcomeRow): Outcome {
  return {
    id: row.id,
    projectId: row.project_id,
    title: row.title,
    successMeasure: row.success_measure,
    deadline: row.deadline ? new Date(row.deadline).toISOString() : null,
    status: row.status,
    priority: row.priority,
  };
}

export function createPgRepository(pool: Pool): PortfolioRepository {
  return {
    dataStatus: 'POSTGRESQL_DATA',
    async listPortfolio(): Promise<PortfolioProject[]> {
      const projects = await pool.query<ProjectRow>(
        'SELECT id, name, engine, classification, status, purpose, links, monthly_cost FROM projects ORDER BY name',
      );
      const outcomes = await pool.query<OutcomeRow>(
        'SELECT id, project_id, title, success_measure, deadline, status, priority FROM outcomes ORDER BY priority, title',
      );
      const byProject = new Map<string, Outcome[]>();
      for (const row of outcomes.rows) {
        const list = byProject.get(row.project_id) ?? [];
        list.push(mapOutcome(row));
        byProject.set(row.project_id, list);
      }
      return projects.rows.map((row) => ({ ...mapProject(row), outcomes: byProject.get(row.id) ?? [] }));
    },

    async activateOutcome(outcomeId: string): Promise<Outcome> {
      const client: PoolClient = await pool.connect();
      try {
        await client.query('BEGIN');
        // One stable lock serializes the count-and-activate policy across instances.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended('aibry-command:active-outcomes', 0))");
        const target = await client.query<OutcomeRow & { project_status: Project['status'] }>(
          `SELECT o.id, o.project_id, o.title, o.success_measure, o.deadline, o.status, o.priority,
                  p.status AS project_status
             FROM outcomes o JOIN projects p ON p.id = o.project_id
            WHERE o.id = $1
            FOR UPDATE OF o, p`,
          [outcomeId],
        );
        if (target.rowCount === 0) {
          throw new OutcomePolicyError('OUTCOME_NOT_FOUND', 'Outcome was not found.');
        }
        const row = target.rows[0];
        if (row.project_status === 'FROZEN') {
          throw new OutcomePolicyError('PROJECT_FROZEN', 'Frozen projects cannot activate outcomes.');
        }
        if (row.status === 'ACTIVE') {
          await client.query('COMMIT');
          return mapOutcome(row);
        }
        if (!['PLANNED', 'BLOCKED'].includes(row.status)) {
          throw new OutcomePolicyError('OUTCOME_NOT_ACTIVATABLE', 'Only planned or blocked outcomes can activate.');
        }
        const active = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM outcomes WHERE status = 'ACTIVE'");
        if (Number(active.rows[0].count) >= 3) {
          throw new OutcomePolicyError('ACTIVE_OUTCOME_LIMIT', 'No more than three active outcomes are allowed.');
        }
        const activated = await client.query<OutcomeRow>(
          "UPDATE outcomes SET status = 'ACTIVE' WHERE id = $1 RETURNING id, project_id, title, success_measure, deadline, status, priority",
          [outcomeId],
        );
        await client.query('COMMIT');
        return mapOutcome(activated.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
