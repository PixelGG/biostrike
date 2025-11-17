import { logger } from '../core/logger';

export interface AuthClaims {
  userId: string;
  sessionId: string;
  expiresAt: number;
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
  const sessionId = `sess_${Math.random().toString(36).slice(2, 10)}`;
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1h TTL prototype
  logger.debug('Token validated (stub)', { userId, sessionId });
  return { userId, sessionId, expiresAt };
}
