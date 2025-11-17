import { config } from '../config/env';
import { logger } from '../core/logger';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) {
    return;
  }

  // Placeholder implementation: wire up MongoDB driver or ORM here.
  logger.info('Connecting to MongoDB', { uri: config.mongoUri });

  // In this prototype, we do not perform a real connection to keep
  // the vertical slice self-contained. The function is here so that
  // match-making, inventory, etc. can be attached later.
  isConnected = true;
}

