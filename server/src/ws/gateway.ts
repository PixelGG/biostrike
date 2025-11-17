import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../core/logger';
import { validateToken } from '../auth/token';
import {
  AIDifficulty,
  ClientMessage,
  Command,
  CommandType,
  MatchMode,
  MatchView,
  ServerMessage,
} from '../types';
import { Match } from '../match';
import { createFloranInstance } from '../data/florans';
import { chooseBotCommand } from '../ai';

interface ConnectionContext {
  userId?: string;
  authenticated: boolean;
  difficulty: AIDifficulty;
  matchId?: string;
  lastSeen: number;
}

interface MatchRecord {
  id: string;
  mode: MatchMode;
  match: Match;
  players: string[];
  difficulty: AIDifficulty;
  createdAt: number;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 120_000;

const sockets = new Set<WebSocket>();
const contexts = new WeakMap<WebSocket, ConnectionContext>();
const userSockets = new Map<string, Set<WebSocket>>();
const matches = new Map<string, MatchRecord>();

function sendMessage(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

function broadcastToMatch(matchId: string, payloadFactory: (state: MatchView) => ServerMessage) {
  const record = matches.get(matchId);
  if (!record) {
    return;
  }

  const state = record.match.getState();
  for (const userId of record.players) {
    const set = userSockets.get(userId);
    if (!set) continue;
    for (const socket of set) {
      sendMessage(socket, payloadFactory(state));
    }
  }
}

function registerSocketForUser(userId: string, socket: WebSocket) {
  let set = userSockets.get(userId);
  if (!set) {
    set = new Set<WebSocket>();
    userSockets.set(userId, set);
  }
  set.add(socket);
}

function unregisterSocket(socket: WebSocket) {
  const ctx = contexts.get(socket);
  if (!ctx || !ctx.userId) {
    return;
  }
  const set = userSockets.get(ctx.userId);
  if (!set) return;
  set.delete(socket);
  if (set.size === 0) {
    userSockets.delete(ctx.userId);
  }
}

function createMatchId(): string {
  return `m_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function handleAuthHello(
  socket: WebSocket,
  ctx: ConnectionContext,
  msg: Extract<ClientMessage, { type: 'auth/hello' }>,
) {
  if (ctx.authenticated) {
    sendMessage(socket, {
      type: 'auth/error',
      payload: { code: 'already_authenticated', message: 'Connection already authenticated.' },
    });
    return;
  }

  const token = msg.payload.token;
  validateToken(token)
    .then((claims) => {
      if (!claims) {
        sendMessage(socket, {
          type: 'auth/error',
          payload: { code: 'invalid_token', message: 'Invalid auth token.' },
        });
        socket.close();
        return;
      }

      ctx.userId = claims.userId;
      ctx.authenticated = true;
      registerSocketForUser(claims.userId, socket);

      logger.info('WS authenticated', { userId: claims.userId });
      sendMessage(socket, {
        type: 'auth/ok',
        payload: { userId: claims.userId },
      });
    })
    .catch((err) => {
      logger.error('Token validation failed', { error: String(err) });
      sendMessage(socket, {
        type: 'auth/error',
        payload: { code: 'auth_failure', message: 'Authentication failed.' },
      });
      socket.close();
    });
}

function handleMatchQueue(
  socket: WebSocket,
  ctx: ConnectionContext,
  msg: Extract<ClientMessage, { type: 'match/queue' }>,
) {
  if (!ctx.authenticated || !ctx.userId) {
    sendMessage(socket, {
      type: 'auth/error',
      payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
    });
    return;
  }

  const { mode, speciesId, difficulty } = msg.payload;
  const effectiveMode: MatchMode = mode ?? 'PVE_BOT';

  if (effectiveMode !== 'PVE_BOT') {
    sendMessage(socket, {
      type: 'error',
      payload: {
        code: 'mode_not_supported',
        message: 'Only PVE_BOT matchmaking is implemented in this prototype.',
      },
    });
    return;
  }

  const playerSpeciesId = speciesId ?? 'sunflower';
  const botSpeciesId = 'cactus';
  const diff: AIDifficulty = difficulty ?? 'easy';

  const player = createFloranInstance(playerSpeciesId);
  const enemy = createFloranInstance(botSpeciesId);
  const match = new Match(player, enemy);
  const matchId = createMatchId();

  const record: MatchRecord = {
    id: matchId,
    mode: 'PVE_BOT',
    match,
    players: [ctx.userId],
    difficulty: diff,
    createdAt: Date.now(),
  };

  matches.set(matchId, record);
  ctx.matchId = matchId;
  ctx.difficulty = diff;

  const state = match.getState();

  sendMessage(socket, {
    type: 'match/found',
    payload: {
      matchId,
      mode: record.mode,
    },
  });

  sendMessage(socket, {
    type: 'match/state',
    payload: {
      matchId,
      state,
    },
  });
}

function handleMatchCommand(
  socket: WebSocket,
  ctx: ConnectionContext,
  msg: Extract<ClientMessage, { type: 'match/command' }>,
) {
  if (!ctx.authenticated || !ctx.userId) {
    sendMessage(socket, {
      type: 'auth/error',
      payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
    });
    return;
  }

  const { matchId, command } = msg.payload;
  if (!matchId || !command) {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'invalid_payload', message: 'matchId and command are required.' },
    });
    return;
  }

  const record = matches.get(matchId);
  if (!record) {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'match_not_found', message: 'Match not found.' },
    });
    return;
  }

  if (!record.players.includes(ctx.userId)) {
    sendMessage(socket, {
      type: 'error',
      payload: { code: 'not_in_match', message: 'You are not a participant of this match.' },
    });
    return;
  }

  const normalizedCommand: Command = {
    type: command.type ?? CommandType.Attack,
    targetIndex: command.targetIndex ?? 1,
    itemId: command.itemId,
  };

  // For PVE_BOT, always position human player at index 0 and bot at index 1.
  const stateBefore = record.match.getState();
  const aiCommand = chooseBotCommand(stateBefore, record.difficulty);

  record.match.nextRound([normalizedCommand, aiCommand]);

  const newState = record.match.getState();

  broadcastToMatch(matchId, (state) => ({
    type: 'match/state',
    payload: { matchId, state },
  }));

  if (newState.isFinished) {
    broadcastToMatch(matchId, (state) => ({
      type: 'match/result',
      payload: { matchId, state },
    }));
    matches.delete(matchId);
    ctx.matchId = undefined;
  }
}

export function attachWebSocketGateway(server: http.Server): void {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (socket) => {
    sockets.add(socket);
    const context: ConnectionContext = {
      authenticated: false,
      difficulty: 'easy',
      lastSeen: Date.now(),
    };
    contexts.set(socket, context);

    logger.info('WebSocket connection opened');

    socket.on('message', (raw) => {
      context.lastSeen = Date.now();

      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        sendMessage(socket, {
          type: 'error',
          payload: { code: 'invalid_json', message: 'Invalid JSON message.' },
        });
        return;
      }

      switch (msg.type) {
        case 'auth/hello':
          handleAuthHello(socket, context, msg);
          break;
        case 'match/queue':
          handleMatchQueue(socket, context, msg);
          break;
        case 'match/cancelQueue':
          // No real queue yet; acknowledge for future compatibility.
          sendMessage(socket, {
            type: 'match/queued',
            payload: { mode: msg.payload.mode },
          });
          break;
        case 'match/command':
          handleMatchCommand(socket, context, msg);
          break;
        case 'chat/send':
          // Basic echo-style chat for now.
          if (!context.userId) {
            sendMessage(socket, {
              type: 'error',
              payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
            });
            return;
          }
          sendMessage(socket, {
            type: 'chat/message',
            payload: {
              channel: msg.payload.channel,
              userId: context.userId,
              message: msg.payload.message,
              at: new Date().toISOString(),
            },
          });
          break;
        default:
          sendMessage(socket, {
            type: 'error',
            payload: { code: 'unknown_type', message: `Unknown message type: ${(msg as any).type}` },
          });
          break;
      }
    });

    socket.on('close', () => {
      logger.info('WebSocket connection closed');
      unregisterSocket(socket);
      contexts.delete(socket);
      sockets.delete(socket);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const socket of sockets) {
      const ctx = contexts.get(socket);
      if (!ctx) continue;
      if (now - ctx.lastSeen > HEARTBEAT_TIMEOUT_MS) {
        logger.warn('Closing idle WebSocket connection', { lastSeen: ctx.lastSeen });
        socket.terminate();
        unregisterSocket(socket);
        contexts.delete(socket);
        sockets.delete(socket);
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}
