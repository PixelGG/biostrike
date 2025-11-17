import { Router } from 'express';
import { listShopItems, purchaseShopItem } from '../../shop/service';

// In lieu of real HTTP auth, we accept a userId header for the prototype.
function getUserId(req: any): string {
  return (req.headers['x-user-id'] as string) ?? 'demo-user';
}

export function createShopRouter(): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const items = listShopItems();
    res.json({ items });
  });

  router.post('/buy', (req, res) => {
    const userId = getUserId(req);
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

