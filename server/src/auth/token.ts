import { logger } from '../core/logger';

export interface AuthClaims {
  userId: string;
}

/**
 * Validates an access token and returns basic claims.
 * In this prototype, the token wird direkt als userId verwendet.
 * Später kann hier echte JWT-Validierung integriert werden.
 */
export async function validateToken(token: string): Promise<AuthClaims | null> {
  const trimmed = token?.trim();
  if (!trimmed) {
    return null;
  }

  // For now, treat the token string itself as the userId.
  const userId = trimmed;
  logger.debug('Token validated (stub)', { userId });
  return { userId };
}

