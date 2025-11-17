import { Router } from 'express';
import {
  createListing,
  getActiveListings,
  cancelListing,
  buyListing,
} from '../../market/service';
import { Region } from '../../types';
import { validateToken } from '../../auth/token';

async function getUserId(req: any): Promise<string | null> {
  const authHeader = req.headers.authorization as string | undefined;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return null;
  const claims = await validateToken(token);
  return claims?.userId ?? null;
}

function getRegion(_req: any): Region {
  // TODO: derive region from user/profile; for now default EU.
  return 'EU';
}

export function createMarketRouter(): Router {
  const router = Router();

  router.get('/listings', (_req, res) => {
    const listings = getActiveListings();
    res.json({ listings });
  });

  router.post('/list', async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
      return;
    }
    const region = getRegion(req);
    const { itemType, refId, priceBC } = req.body as {
      itemType?: 'floran' | 'item';
      refId?: string;
      priceBC?: number;
    };

    if (!itemType || !refId || typeof priceBC !== 'number') {
      res.status(400).json({ error: 'itemType_refId_priceBC_required' });
      return;
    }

    try {
      const listing = createListing(userId, {
        itemType,
        refId,
        priceBC,
        region,
      });
      res.json({ listing });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/cancel', async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
      return;
    }
    const { listingId } = req.body as { listingId?: string };

    if (!listingId) {
      res.status(400).json({ error: 'listingId_required' });
      return;
    }

    try {
      const listing = cancelListing(userId, listingId);
      res.json({ listing });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.post('/buy', async (req, res) => {
    const userId = await getUserId(req);
    if (!userId) {
      res.status(401).json({ error: 'ACCESS_TOKEN_REQUIRED' });
      return;
    }
    const { listingId } = req.body as { listingId?: string };

    if (!listingId) {
      res.status(400).json({ error: 'listingId_required' });
      return;
    }

    try {
      const { listing, transaction } = buyListing(userId, listingId);
      res.json({ listing, transaction });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}
