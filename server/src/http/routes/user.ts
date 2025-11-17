import { Router } from 'express';

export function createUserRouter(): Router {
  const router = Router();

  router.get('/profile', (_req, res) => {
    res.status(501).json({ error: 'not_implemented', message: 'Profile is not implemented yet.' });
  });

  router.get('/progression', (_req, res) => {
    res
      .status(501)
      .json({ error: 'not_implemented', message: 'Progression is not implemented yet.' });
  });

  router.patch('/settings', (_req, res) => {
    res.status(501).json({ error: 'not_implemented', message: 'Settings are not implemented yet.' });
  });

  return router;
}

