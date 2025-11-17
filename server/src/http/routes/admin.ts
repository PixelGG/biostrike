import { Router } from 'express';
import { getMetricsSnapshot } from '../../observability/metrics';
import { getRecentEvents } from '../../observability/telemetry';
import { validateToken } from '../../auth/token';
import { getAccountById } from '../../auth/service';

async function requireAdmin(req: Parameters<Router['get']>[1], res: any, next: any) {
  const authHeader = (req as any).headers.authorization as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

  if (!token) {
    (res as any).status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
    return;
  }

  const claims = await validateToken(token);
  if (!claims) {
    (res as any).status(401).json({ error: 'ACCESS_TOKEN_INVALID' });
    return;
  }

  const user = getAccountById(claims.userId);
  if (!user || user.role !== 'admin') {
    (res as any).status(403).json({ error: 'ADMIN_REQUIRED' });
    return;
  }

  // Attach userId for downstream handlers if needed.
  (req as any).adminUserId = user.id;
  next();
}

export function createAdminRouter(): Router {
  const router = Router();

  // All routes under /api/admin require an admin access token.
  router.use(requireAdmin as any);

  router.get('/metrics', (_req, res) => {
    const snapshot = getMetricsSnapshot();
    res.json({ metrics: snapshot });
  });

  router.get('/events', (req, res) => {
    const limitParam = (req.query.limit as string | undefined) ?? '100';
    const limit = Number.parseInt(limitParam, 10);
    const safeLimit = Number.isNaN(limit) ? 100 : Math.max(1, Math.min(limit, 500));
    const events = getRecentEvents(safeLimit);
    res.json({ events });
  });

  return router;
}

