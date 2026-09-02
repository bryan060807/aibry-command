import type { NextFunction, Request, Response } from 'express';
import type { Logger } from '../logging.js';

export type AuthorizationOperation = 'portfolio.read' | 'outcome.activate';
export interface AuthorizationContext {
  operation: AuthorizationOperation;
  method: string;
  path: string;
}
export type Authorizer = (context: AuthorizationContext) => boolean | Promise<boolean>;

/** Default is deliberately fail-closed until the approved AIBRY ID OIDC seam is connected. */
export const denyByDefault: Authorizer = () => false;

export function requireAuthorization(
  operation: AuthorizationOperation,
  authorizer: Authorizer = denyByDefault,
  logger?: Logger,
) {
  return async (request: Request, response: Response, next: NextFunction): Promise<void> => {
    const allowed = await authorizer({ operation, method: request.method, path: request.path });
    if (!allowed) {
      logger?.warn('authorization.denied', { operation });
      response.status(401).json({ error: 'authorization_required' });
      return;
    }
    next();
  };
}
