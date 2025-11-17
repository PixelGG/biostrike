import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { Match } from './match';
import { sampleFlorans } from './data/florans';
import { ClientMessage, Command, CommandType, ServerMessage } from './types';

const app = express();

app.use(express.json());

// Simple health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

interface ConnectionContext {
  match?: Match;
}

const contexts = new WeakMap<WebSocket, ConnectionContext>();

function sendMessage(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

function cloneFloranTemplate(index: number) {
  // Templates are treated as immutable; clone via JSON for now.
  return JSON.parse(JSON.stringify(sampleFlorans[index]));
}

wss.on('connection', (socket) => {
  const context: ConnectionContext = {};
  contexts.set(socket, context);

  console.log('Client connected');

  sendMessage(socket, {
    type: 'welcome',
    payload: { message: 'Welcome to the BioStrike prototype server.' },
  });

  socket.on('message', (raw) => {
    let msg: ClientMessage;

    try {
      msg = JSON.parse(raw.toString());
    } catch {
      sendMessage(socket, {
        type: 'error',
        payload: { message: 'Invalid JSON message.' },
      });
      return;
    }

    if (msg.type === 'start_match') {
      const player = cloneFloranTemplate(0);
      const enemy = cloneFloranTemplate(1);

      context.match = new Match(player, enemy);

      sendMessage(socket, {
        type: 'match_state',
        payload: context.match.getState(),
      });
      return;
    }

    if (msg.type === 'command') {
      if (!context.match) {
        sendMessage(socket, {
          type: 'error',
          payload: { message: 'No active match. Send start_match first.' },
        });
        return;
      }

      const { command } = msg.payload;
      const normalizedCommand: Command = {
        type: command.type ?? CommandType.Attack,
        targetIndex: 1,
      };

      const enemyCommand: Command = {
        type: CommandType.Attack,
        targetIndex: 0,
      };

      context.match.nextRound([normalizedCommand, enemyCommand]);

      sendMessage(socket, {
        type: 'match_state',
        payload: context.match.getState(),
      });
      return;
    }

    sendMessage(socket, {
      type: 'error',
      payload: { message: 'Unknown message type.' },
    });
  });

  socket.on('close', () => {
    console.log('Client disconnected');
    contexts.delete(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`BioStrike server listening on port ${PORT}`);
});
