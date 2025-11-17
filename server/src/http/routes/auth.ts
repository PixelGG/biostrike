import { Router } from 'express';

export function createAuthRouter(): Router {
  const router = Router();

  router.post('/register', (req, res) => {
    // Placeholder implementation.
    res.status(501).json({ error: 'not_implemented', message: 'Register is not implemented yet.' });
  });

  router.post('/login', (req, res) => {
    // Placeholder implementation.
    res.status(501).json({ error: 'not_implemented', message: 'Login is not implemented yet.' });
  });

  router.get('/me', (req, res) => {
    // Placeholder implementation.
    res.status(501).json({ error: 'not_implemented', message: 'Me endpoint is not implemented yet.' });
  });

  return router;
}

