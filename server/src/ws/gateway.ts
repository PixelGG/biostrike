import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../core/logger';
import { validateToken } from '../auth/token';
import {
  AIDifficulty,
  ClientMessage,
  ClientMessagePayload,
  Command,
  CommandType,
  EnvelopeMeta,
  MatchMode,
  MatchView,
  ServerMessage,
  ServerMessagePayload,
} from '../types';
import { Match } from '../match';
import { createFloranInstance } from '../data/florans';
import { chooseBotCommand } from '../ai';

type ConnectionState = 'AUTHENTICATING' | 'READY' | 'THROTTLED' | 'CLOSING' | 'CLOSED';

interface ConnectionContext {
  userId?: string;
  sessionId?: string;
  authenticated: boolean;
  difficulty: AIDifficulty;
  matchId?: string;
  lastSeen: number;
  state: ConnectionState;
  // Rate limiting
  windowStart: number;
  msgCountInWindow: number;
  throttleUntil?: number;
  // Outgoing sequence counter
  outSeq: number;
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
const MAX_MSG_PER_SECOND = 50;
const THROTTLE_DURATION_MS = 5_000;
const MAX_BUFFERED_BYTES = 1_000_000;

const sockets = new Set<WebSocket>();
const contexts = new WeakMap<WebSocket, ConnectionContext>();
const userSockets = new Map<string, Set<WebSocket>>();
const matches = new Map<string, MatchRecord>();

function makeEnvelopeMeta(ctx: ConnectionContext): EnvelopeMeta {
  ctx.outSeq += 1;
  return {
    id: `srv_${Date.now().toString(36)}_${ctx.outSeq.toString(36)}`,
    seq: ctx.outSeq,
    ts: new Date().toISOString(),
  };
}

function sendMessage(
  socket: WebSocket,
  ctx: ConnectionContext | undefined,
  payload: ServerMessagePayload,
): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  if (socket.bufferedAmount > MAX_BUFFERED_BYTES) {
    logger.warn('Closing connection due to excessive bufferedAmount', {
      bufferedAmount: socket.bufferedAmount,
    });
    socket.close();
    return;
  }

  const meta = ctx ? makeEnvelopeMeta(ctx) : { id: 'srv_' + Date.now().toString(36) };
  const message: ServerMessage = {
    ...(meta as EnvelopeMeta),
    ...payload,
  };

  socket.send(JSON.stringify(message));
}

function broadcastToMatch(
  matchId: string,
  payloadFactory: (state: MatchView) => ServerMessagePayload,
) {
  const record = matches.get(matchId);
  if (!record) {
    return;
  }

  const state = record.match.getState();
  for (const userId of record.players) {
    const set = userSockets.get(userId);
    if (!set) continue;
    for (const socket of set) {
      const ctx = contexts.get(socket);
      sendMessage(socket, ctx, payloadFactory(state));
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
  if (ctx.authenticated || ctx.state !== 'AUTHENTICATING') {
    sendMessage(socket, ctx, {
      type: 'auth/error',
      payload: { code: 'already_authenticated', message: 'Connection already authenticated.' },
    });
    return;
  }

  const token = msg.payload.token;
  validateToken(token)
    .then((claims) => {
      if (!claims) {
        sendMessage(socket, ctx, {
          type: 'auth/error',
          payload: { code: 'invalid_token', message: 'Invalid auth token.' },
        });
        ctx.state = 'CLOSING';
        socket.close();
        return;
      }

      ctx.userId = claims.userId;
      ctx.authenticated = true;
      ctx.state = 'READY';
      ctx.sessionId = claims.sessionId;
      registerSocketForUser(claims.userId, socket);

      logger.info('WS authenticated', { userId: claims.userId });
      sendMessage(socket, ctx, {
        type: 'auth/ok',
        payload: { userId: claims.userId, sessionId: ctx.sessionId! },
      });
    })
    .catch((err) => {
      logger.error('Token validation failed', { error: String(err) });
      sendMessage(socket, ctx, {
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
  if (!ctx.authenticated || !ctx.userId || ctx.state !== 'READY') {
    sendMessage(socket, ctx, {
      type: 'auth/error',
      payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
    });
    return;
  }

  const { mode, speciesId, difficulty } = msg.payload;
  const effectiveMode: MatchMode = mode ?? 'PVE_BOT';

  if (effectiveMode !== 'PVE_BOT') {
    sendMessage(socket, ctx, {
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

  sendMessage(socket, ctx, {
    type: 'match/found',
    payload: {
      matchId,
      mode: record.mode,
    },
  });

  sendMessage(socket, ctx, {
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
  if (!ctx.authenticated || !ctx.userId || ctx.state !== 'READY') {
    sendMessage(socket, ctx, {
      type: 'auth/error',
      payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
    });
    return;
  }

  const { matchId, command } = msg.payload;
  if (!matchId || !command) {
    sendMessage(socket, ctx, {
      type: 'error',
      payload: { code: 'invalid_payload', message: 'matchId and command are required.' },
    });
    return;
  }

  const record = matches.get(matchId);
  if (!record) {
    sendMessage(socket, ctx, {
      type: 'error',
      payload: { code: 'match_not_found', message: 'Match not found.' },
    });
    return;
  }

  if (!record.players.includes(ctx.userId)) {
    sendMessage(socket, ctx, {
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
      state: 'AUTHENTICATING',
      windowStart: Date.now(),
      msgCountInWindow: 0,
      outSeq: 0,
    };
    contexts.set(socket, context);

    logger.info('WebSocket connection opened');

    socket.on('message', (raw) => {
      context.lastSeen = Date.now();

      let msg: ClientMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientMessage;
      } catch {
        sendMessage(socket, context, {
          type: 'error',
          payload: { code: 'invalid_json', message: 'Invalid JSON message.' },
        });
        return;
      }

      // Basic per-connection rate limiting.
      const now = Date.now();
      if (now - context.windowStart > 1000) {
        context.windowStart = now;
        context.msgCountInWindow = 0;
      }
      context.msgCountInWindow += 1;
      if (context.msgCountInWindow > MAX_MSG_PER_SECOND) {
        context.state = 'THROTTLED';
        context.throttleUntil = now + THROTTLE_DURATION_MS;
        logger.warn('Connection throttled due to rate limit', {
          userId: context.userId,
        });
        sendMessage(socket, context, {
          type: 'error',
          payload: {
            code: 'rate_limited',
            message: 'Too many messages per second. Please slow down.',
          },
        });
        return;
      }

      if (context.state === 'THROTTLED' && context.throttleUntil && now < context.throttleUntil) {
        // Drop non-system messages while throttled.
        if (msg.type !== 'system/pong') {
          return;
        }
      } else if (context.state === 'THROTTLED' && context.throttleUntil && now >= context.throttleUntil) {
        context.state = context.authenticated ? 'READY' : 'AUTHENTICATING';
        context.throttleUntil = undefined;
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
          sendMessage(socket, context, {
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
            sendMessage(socket, context, {
              type: 'error',
              payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
            });
            return;
          }
          sendMessage(socket, context, {
            type: 'chat/message',
            payload: {
              channel: msg.payload.channel,
              userId: context.userId,
              message: msg.payload.message,
              at: new Date().toISOString(),
            },
          });
          break;
        case 'system/pong':
          // Heartbeat response, nothing else to do.
          break;
        default:
          sendMessage(socket, context, {
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
        ctx.state = 'CLOSING';
        socket.terminate();
        unregisterSocket(socket);
        contexts.delete(socket);
        sockets.delete(socket);
        continue;
      }

      if (ctx.state === 'READY' && now - ctx.lastSeen > HEARTBEAT_INTERVAL_MS) {
        sendMessage(socket, ctx, { type: 'system/ping', payload: {} });
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}
