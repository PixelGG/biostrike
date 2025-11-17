import { Router } from 'express';
import {
  createListing,
  getActiveListings,
  cancelListing,
  buyListing,
} from '../../market/service';
import { Region } from '../../types';

function getUserId(req: any): string {
  return (req.headers['x-user-id'] as string) ?? 'demo-user';
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

  router.post('/list', (req, res) => {
    const userId = getUserId(req);
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

  router.post('/cancel', (req, res) => {
    const userId = getUserId(req);
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

  router.post('/buy', (req, res) => {
    const userId = getUserId(req);
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

