import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';

const app = express();

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Create HTTP and WebSocket servers
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (socket) => {
  console.log('Client connected');

  socket.on('message', (message) => {
    const msg = message.toString();
    console.log('Received:', msg);
    // Echo message back as an example
    socket.send(JSON.stringify({ type: 'echo', data: msg }));
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`BioStrike server listening on port ${PORT}`);
});
