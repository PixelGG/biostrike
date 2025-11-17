import express from 'express';
import { createAuthRouter } from './routes/auth';
import { createUserRouter } from './routes/user';
import { createMetaRouter } from './routes/meta';

export function createApiRouter(): express.Router {
  const router = express.Router();

  router.use('/auth', createAuthRouter());
  router.use('/user', createUserRouter());
  router.use('/meta', createMetaRouter());

  // Inventory, market, shop, pve, quests, admin etc. can be added here.

  return router;
}

