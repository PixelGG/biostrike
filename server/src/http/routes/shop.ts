import { Router } from 'express';
import { listShopItems, purchaseShopItem } from '../../shop/service';
import { validateToken } from '../../auth/token';

async function getUserId(req: any): Promise<string | null> {
  const authHeader = req.headers.authorization as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return null;
  const claims = await validateToken(token);
  return claims?.userId ?? null;
}

export function createShopRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const items = listShopItems();
    res.json({ items });
  });

  router.post('/buy', async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
      return;
    }
    const { shopItemId } = req.body as { shopItemId?: string };

    if (!shopItemId) {
      res.status(400).json({ error: 'shopItemId_required' });
      return;
    }

    try {
      const result = purchaseShopItem(userId, shopItemId);
      res.json({
        item: result.item,
        wallet: result.bc.after,
      });
    } catch (err) {
      const message = (err as Error).message;
      res.status(400).json({ error: message });
    }
  });

  return router;
}
