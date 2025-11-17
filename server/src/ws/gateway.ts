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
  MatchTicket,
  MatchView,
  Region,
  ServerMessage,
  ServerMessagePayload,
} from '../types';
import {
  ensureMatchChannel,
  getChannelById,
  getChannelMembers,
  getMessageById as getChatMessageById,
  flagMessageForModeration,
  LOBBY_GLOBAL_CHANNEL_ID,
  sendChatMessage,
  joinChannel as chatJoinChannel,
  leaveChannel as chatLeaveChannel,
} from '../chat/service';
import { blockUser, hasBlocked } from '../social/service';
import { createModerationCase } from '../moderation/service';
import { getAccountById } from '../auth/service';
import { Match } from '../match';
import { createFloranInstance } from '../data/florans';
import { chooseBotCommand } from '../ai';
import {
  cancelQueue,
  enqueuePlayer,
  setMatchFoundHandler,
  startMatchmakingLoop,
} from '../matchmaking/service';
import { processMatchResult } from '../rewards/service';
import { handleMatchResultForQuests } from '../liveops/service';

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
  chatChannelId?: string;
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

// Start the global matchmaking loop once when the gateway module is loaded.
startMatchmakingLoop();


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

function defaultRegion(): Region {
  // TODO: infer from user/session/IP; for now, use EU as default.
  return 'EU';
}

function onTicketFromMatchmaking(ticket: MatchTicket): void {
  const { id: matchId, mode, region, players } = ticket;

  // For now we only support 1v1 PvP tickets.
  if (players.length !== 2) {
    logger.warn('Unsupported ticket player count', { matchId, count: players.length });
    return;
  }

  const [a, b] = players;
  const playerA = createFloranInstance('sunflower');
  const playerB = createFloranInstance('cactus');

  const participantUserIds = [a.userId, b.userId];
  const chatChannelId = ensureMatchChannel(matchId, participantUserIds);

  const match = new Match(playerA, playerB, { id: matchId, mode, arenaId: region });
  const record: MatchRecord = {
    id: matchId,
    mode,
    match,
    players: participantUserIds,
    difficulty: 'easy',
    createdAt: Date.now(),
    chatChannelId,
  };

  matches.set(matchId, record);

  const state = match.getState();

  // Notify both players that the match was found.
  for (const userId of record.players) {
    const socketsForUser = userSockets.get(userId);
    if (!socketsForUser) continue;
    for (const socket of socketsForUser) {
      const ctx = contexts.get(socket);
      if (!ctx) continue;
      sendMessage(socket, ctx, {
        type: 'match/found',
        payload: { matchId, mode, opponent: undefined },
      });
      sendMessage(socket, ctx, {
        type: 'match/state',
        payload: { matchId, state },
      });
    }
  }
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

      const account = getAccountById(claims.userId);
      if (account && (account.status === 'banned' || account.status === 'deleted')) {
        sendMessage(socket, ctx, {
          type: 'auth/error',
          payload: { code: 'account_not_allowed', message: 'Account is not allowed to connect.' },
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
      // Auto-join global lobby chat for convenience.
      try {
        chatJoinChannel(claims.userId, LOBBY_GLOBAL_CHANNEL_ID);
      } catch (err) {
        logger.warn('Failed to auto-join lobby channel', {
          userId: claims.userId,
          error: String(err),
        });
      }

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

  if (effectiveMode === 'PVE_BOT') {
      const playerSpeciesId = speciesId ?? 'sunflower';
      const botSpeciesId = 'cactus';
      const diff: AIDifficulty = difficulty ?? 'easy';

      const player = createFloranInstance(playerSpeciesId);
      const enemy = createFloranInstance(botSpeciesId);
      const match = new Match(player, enemy);
      const matchId = createMatchId();
      const participants = [ctx.userId];
      const chatChannelId = ensureMatchChannel(matchId, participants);

      const record: MatchRecord = {
        id: matchId,
        mode: 'PVE_BOT',
        match,
        players: participants,
        difficulty: diff,
        createdAt: Date.now(),
        chatChannelId,
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
    return;
  }

  const region: Region = defaultRegion();
  enqueuePlayer(ctx.userId, effectiveMode, region);

  sendMessage(socket, ctx, {
    type: 'match/queued',
    payload: { mode: effectiveMode },
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
    const durationSeconds = (Date.now() - record.createdAt) / 1000;

    const result = {
      matchId,
      mode: record.mode,
      arenaId: newState.arenaId,
      durationSeconds,
      state: newState,
      players: record.players.map((userId, idx) => ({
        userId,
        isWinner: newState.winnerIndex === idx,
      })),
    };

    processMatchResult(result);
    handleMatchResultForQuests(result);

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

  // Register matchmaking callback once.
  setMatchFoundHandler(onTicketFromMatchmaking);

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
          cancelQueue(context.userId!, msg.payload.mode, defaultRegion());
          sendMessage(socket, context, {
            type: 'match/queued',
            payload: { mode: msg.payload.mode },
          });
          break;
        case 'match/command':
          handleMatchCommand(socket, context, msg);
          break;
        case 'chat/send':
          if (!context.authenticated || !context.userId || context.state !== 'READY') {
            sendMessage(socket, context, {
              type: 'error',
              payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
            });
            return;
          }
          try {
            const channelId = msg.payload.channel;
            const account = getAccountById(context.userId);
            if (account && (account.status === 'banned' || account.status === 'deleted')) {
              sendMessage(socket, context, {
                type: 'error',
                payload: {
                  code: 'chat_forbidden',
                  message: 'Chat is not available for this account.',
                },
              });
              return;
            }

            const channel = getChannelById(channelId);
            if (!channel) {
              sendMessage(socket, context, {
                type: 'error',
                payload: { code: 'chat_channel_not_found', message: 'Chat channel not found.' },
              });
              return;
            }

            const { message, deliverToChannelMembers } = sendChatMessage({
              channelId,
              senderUserId: context.userId,
              content: msg.payload.message,
            });

            const payload: ServerMessagePayload = {
              type: 'chat/message',
              payload: {
                channel: channelId,
                userId: context.userId,
                message: message.content,
                at: new Date(message.createdAt).toISOString(),
                messageId: message.id,
                moderationState: message.moderationState,
                flags: message.flags.length > 0 ? message.flags : undefined,
              },
            };

            const recipients = deliverToChannelMembers
              ? getChannelMembers(channelId)
              : new Set<string>([context.userId]);

            for (const userId of recipients) {
              const socketsForUser = userSockets.get(userId);
              if (!socketsForUser || socketsForUser.size === 0) continue;
              // Respect block lists: if the receiving user has blocked the sender,
              // do not deliver the message to that user.
              if (hasBlocked(userId, context.userId)) {
                continue;
              }
              for (const s of socketsForUser) {
                const receiverCtx = contexts.get(s);
                sendMessage(s, receiverCtx, payload);
              }
            }
          } catch (err) {
            const msgText = String(err);
            let code = 'chat_error';
            if (msgText.includes('CHAT_CHANNEL_NOT_FOUND')) {
              code = 'chat_channel_not_found';
            } else if (msgText.includes('CHAT_NOT_IN_CHANNEL')) {
              code = 'chat_not_in_channel';
            } else if (msgText.includes('CHAT_MESSAGE_EMPTY')) {
              code = 'chat_message_empty';
            } else if (msgText.includes('CHAT_MESSAGE_TOO_LONG')) {
              code = 'chat_message_too_long';
            }

            sendMessage(socket, context, {
              type: 'error',
              payload: {
                code,
                message: 'Chat-Nachricht konnte nicht gesendet werden.',
              },
            });
          }
          break;
        case 'chat/join':
          if (!context.authenticated || !context.userId || context.state !== 'READY') {
            sendMessage(socket, context, {
              type: 'error',
              payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
            });
            return;
          }
          try {
            const channelId = msg.payload.channel;
            const channel = chatJoinChannel(context.userId, channelId);
            logger.info('WS chat/join processed', { userId: context.userId, channelId });
            // Optionally send a small system message back to the joining user.
            sendMessage(socket, context, {
              type: 'chat/system',
              payload: {
                channel: channel.id,
                message: `Du bist dem Channel ${channel.id} beigetreten.`,
              },
            });
          } catch (err) {
            sendMessage(socket, context, {
              type: 'error',
              payload: {
                code: 'chat_join_failed',
                message: 'Channel-Beitritt fehlgeschlagen.',
              },
            });
          }
          break;
        case 'chat/leave':
          if (!context.authenticated || !context.userId || context.state !== 'READY') {
            sendMessage(socket, context, {
              type: 'error',
              payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
            });
            return;
          }
          try {
            const channelId = msg.payload.channel;
            chatLeaveChannel(context.userId, channelId);
            logger.info('WS chat/leave processed', { userId: context.userId, channelId });
          } catch (err) {
            sendMessage(socket, context, {
              type: 'error',
              payload: {
                code: 'chat_leave_failed',
                message: 'Channel-Verlassen fehlgeschlagen.',
              },
            });
          }
          break;
        case 'chat/block':
          if (!context.authenticated || !context.userId || context.state !== 'READY') {
            sendMessage(socket, context, {
              type: 'error',
              payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
            });
            return;
          }
          blockUser(context.userId, msg.payload.targetUserId);
          sendMessage(socket, context, {
            type: 'chat/system',
            payload: {
              channel: 'system',
              message: `User ${msg.payload.targetUserId} wurde blockiert.`,
            },
          });
          break;
        case 'chat/report':
          if (!context.authenticated || !context.userId || context.state !== 'READY') {
            sendMessage(socket, context, {
              type: 'error',
              payload: { code: 'unauthenticated', message: 'Authenticate first via auth/hello.' },
            });
            return;
          }
          try {
            const chatMsg = getChatMessageById(msg.payload.messageId);
            if (!chatMsg) {
              sendMessage(socket, context, {
                type: 'error',
                payload: {
                  code: 'chat_message_not_found',
                  message: 'Gemeldete Nachricht nicht gefunden.',
                },
              });
              return;
            }

            flagMessageForModeration(chatMsg.id, [], 'PENDING_REVIEW');

            createModerationCase({
              reportedUserId: chatMsg.senderUserId,
              reportedMessageIds: [chatMsg.id],
              reportedByUserId: context.userId,
              reasonCategories: [msg.payload.category],
            });

            sendMessage(socket, context, {
              type: 'chat/system',
              payload: {
                channel: chatMsg.channelId,
                message: 'Danke, deine Meldung wurde aufgenommen.',
              },
            });
          } catch (err) {
            sendMessage(socket, context, {
              type: 'error',
              payload: {
                code: 'chat_report_failed',
                message: 'Meldung konnte nicht verarbeitet werden.',
              },
            });
          }
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
