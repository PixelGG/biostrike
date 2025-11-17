import { logger } from '../core/logger';
import {
  MatchMode,
  MatchTicket,
  MatchTicketPlayer,
  PlayerRating,
  QueueEntry,
  Region,
} from '../types';
import { getPlayerRating } from '../rating/service';

type QueueKey = `${MatchMode}:${Region}`;

const queues = new Map<QueueKey, QueueEntry[]>();

type MatchFoundHandler = (ticket: MatchTicket) => void;

let onMatchFound: MatchFoundHandler | undefined;

export function setMatchFoundHandler(handler: MatchFoundHandler): void {
  onMatchFound = handler;
}

export function enqueuePlayer(userId: string, mode: MatchMode, region: Region): QueueEntry {
  const rating = getPlayerRating(userId, mode);
  const entry: QueueEntry = {
    userId,
    mode,
    region,
    rating,
    enqueueTime: Date.now(),
  };

  const key: QueueKey = `${mode}:${region}`;
  const list = queues.get(key) ?? [];
  list.push(entry);
  queues.set(key, list);

  logger.info('Enqueued player', { userId, mode, region, rating: rating.ratingValue });

  return entry;
}

export function cancelQueue(userId: string, mode: MatchMode, region: Region): void {
  const key: QueueKey = `${mode}:${region}`;
  const list = queues.get(key);
  if (!list) return;
  const filtered = list.filter((e) => e.userId !== userId);
  queues.set(key, filtered);
  logger.info('Cancelled queue entry', { userId, mode, region });
}

function createMatchTicket(
  mode: MatchMode,
  region: Region,
  a: QueueEntry,
  b: QueueEntry,
): MatchTicket {
  const id = `mm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const players: MatchTicketPlayer[] = [
    {
      userId: a.userId,
      rating: a.rating,
      side: 'A',
    },
    {
      userId: b.userId,
      rating: b.rating,
      side: 'B',
    },
  ];

  return {
    id,
    mode,
    region,
    players,
    createdAt: Date.now(),
  };
}

function ratingDifference(a: PlayerRating, b: PlayerRating): number {
  return Math.abs(a.ratingValue - b.ratingValue);
}

function runMatchmakingPassForQueue(key: QueueKey): void {
  const list = queues.get(key);
  if (!list || list.length < 2 || !onMatchFound) {
    return;
  }

  // Sort by enqueue time to prioritise oldest entries.
  list.sort((a, b) => a.enqueueTime - b.enqueueTime);

  const now = Date.now();

  const matchedIndices = new Set<number>();

  for (let i = 0; i < list.length; i++) {
    if (matchedIndices.has(i)) continue;

    const entry = list[i];
    const waitSeconds = (now - entry.enqueueTime) / 1000;

    // Dynamic rating window: grows with wait time.
    const deltaInitial = 50;
    const deltaMax = entry.mode === 'PVP_RANKED' ? 250 : 400;
    const growthPerSecond = 10;

    const delta = Math.min(deltaMax, deltaInitial + waitSeconds * growthPerSecond);

    let bestIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let j = i + 1; j < list.length; j++) {
      if (matchedIndices.has(j)) continue;

      const candidate = list[j];

      const diff = ratingDifference(entry.rating, candidate.rating);
      if (diff > delta) continue;

      // Simple score: first minimise rating difference, then waiting time of candidate.
      const candidateWait = (now - candidate.enqueueTime) / 1000;
      const score = diff - candidateWait * 0.1;

      if (score < bestScore) {
        bestScore = score;
        bestIndex = j;
      }
    }

    if (bestIndex >= 0) {
      const a = entry;
      const b = list[bestIndex];
      matchedIndices.add(i);
      matchedIndices.add(bestIndex);

      const [mode, region] = key.split(':') as [MatchMode, Region];
      const ticket = createMatchTicket(mode, region, a, b);

      logger.info('Match found', {
        matchId: ticket.id,
        mode,
        region,
        players: ticket.players.map((p) => ({ userId: p.userId, rating: p.rating.ratingValue })),
      });

      onMatchFound(ticket);
    }
  }

  // Remove matched entries from the queue.
  if (matchedIndices.size > 0) {
    const remaining: QueueEntry[] = [];
    list.forEach((entry, index) => {
      if (!matchedIndices.has(index)) {
        remaining.push(entry);
      }
    });
    queues.set(key, remaining);
  }
}

export function startMatchmakingLoop(intervalMs = 500): void {
  setInterval(() => {
    const keys = Array.from(queues.keys());
    for (const key of keys) {
      runMatchmakingPassForQueue(key);
    }
  }, intervalMs);
}

