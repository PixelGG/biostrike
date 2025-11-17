import express from 'express';
import { createAuthRouter } from './routes/auth';
import { createUserRouter } from './routes/user';
import { createMetaRouter } from './routes/meta';
import { createShopRouter } from './routes/shop';
import { createMarketRouter } from './routes/market';
import { createAdminRouter } from './routes/admin';

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.use('/auth', createAuthRouter());
  router.use('/user', createUserRouter());
  router.use('/meta', createMetaRouter());
  router.use('/shop', createShopRouter());
  router.use('/market', createMarketRouter());
  router.use('/admin', createAdminRouter());

  // Inventory, pve, quests, admin etc. can be added here.

  return router;
}
