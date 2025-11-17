import { Router } from 'express';
import { floranSpecies } from '../../data/florans';
import { items } from '../../data/items';

export function createMetaRouter(): Router {
  const router = Router();

  router.get('/florans', (_req, res) => {
    res.json({ florans: floranSpecies });
  });

  router.get('/items', (_req, res) => {
    res.json({ items });
  });

  router.get('/arenas', (_req, res) => {
    // Placeholder: arenas will be added later.
    res.json({ arenas: [] });
  });

  router.get('/events', (_req, res) => {
    // Placeholder: events will be managed by an EventService later.
    res.json({ events: [] });
  });

  return router;
}
