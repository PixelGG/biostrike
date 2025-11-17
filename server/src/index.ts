import express from 'express';
import http from 'http';
import { config } from './config/env';
import { logger } from './core/logger';
import { createApiRouter } from './http/api';
import { connectDatabase } from './db';
import { attachWebSocketGateway } from './ws/gateway';
import { startLiveOpsScheduler } from './liveops/service';

const app = express();

app.use(express.json());

// Simple health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api', createApiRouter());

const server = http.createServer(app);
attachWebSocketGateway(server);

async function start() {
  await connectDatabase();
  // Start LiveOps scheduler (events/quests) and matchmaking loop.
  startLiveOpsScheduler();

  server.listen(config.port, () => {
    logger.info(`BioStrike server listening`, { port: config.port, env: config.env });
  });
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
start();
