import { AccessTokenClaims, validateAccessToken } from './service';

export interface AuthClaims {
  userId: string;
  sessionId: string;
  expiresAt: number;
}

/**
 * Validates an access token and returns basic claims.
 */
export async function validateToken(token: string): Promise<AuthClaims | null> {
  const trimmed = token?.trim();
  if (!trimmed) {
    return null;
  }

  const claims: AccessTokenClaims | null = validateAccessToken(trimmed);
  if (!claims) {
    return null;
  }

  return {
    userId: claims.sub,
    sessionId: claims.sid,
    expiresAt: claims.exp * 1000,
  };
}

