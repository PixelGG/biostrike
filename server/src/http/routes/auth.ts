import { Router } from 'express';
import {
  getAccountById,
  loginUser,
  refreshTokenPair,
  registerUser,
} from '../../auth/service';
import { validateToken } from '../../auth/token';

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'USERNAME_PASSWORD_REQUIRED' });
      return;
    }

    try {
      const user = await registerUser(username, password);
      res.status(201).json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
        },
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/login', async (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      res.status(400).json({ error: 'USERNAME_PASSWORD_REQUIRED' });
      return;
    }

    try {
      const ip = req.ip;
      const userAgent = req.headers['user-agent'] as string | undefined;
      const result = await loginUser(username, password, ip, userAgent);
      res.json({
        user: {
          id: result.user.id,
          username: result.user.username,
          role: result.user.role,
        },
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        accessTokenExpiresAt: result.accessTokenExpiresAt,
        refreshTokenExpiresAt: result.refreshTokenExpiresAt,
      });
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
    }
  });

  router.post('/refresh', (req, res) => {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(400).json({ error: 'REFRESH_TOKEN_REQUIRED' });
      return;
    }
    try {
      const ip = req.ip;
      const userAgent = req.headers['user-agent'] as string | undefined;
      const tokens = refreshTokenPair(refreshToken, ip, userAgent);
      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      });
    } catch (err) {
      res.status(401).json({ error: (err as Error).message });
    }
  });

  router.get('/me', async (req, res) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    if (!token) {
      res.status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
      return;
    }

    const claims = await validateToken(token);
    if (!claims) {
      res.status(401).json({ error: 'ACCESS_TOKEN_INVALID' });
      return;
    }

    const user = getAccountById(claims.userId);
    if (!user) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    });
  });

  return router;
}
