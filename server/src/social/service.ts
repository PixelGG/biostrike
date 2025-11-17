import { logger } from '../core/logger';
import { SocialGraph } from '../types';

const graphs = new Map<string, SocialGraph>();

function getOrCreateGraph(userId: string): SocialGraph {
  let graph = graphs.get(userId);
  if (!graph) {
    graph = {
      userId,
      friends: [],
      blocks: [],
    };
    graphs.set(userId, graph);
  }
  return graph;
}

export function blockUser(userId: string, targetUserId: string): void {
  if (userId === targetUserId) {
    return;
  }
  const graph = getOrCreateGraph(userId);
  if (!graph.blocks.includes(targetUserId)) {
    graph.blocks.push(targetUserId);
    logger.info('User blocked another user', { userId, targetUserId });
  }
}

export function unblockUser(userId: string, targetUserId: string): void {
  const graph = getOrCreateGraph(userId);
  const before = graph.blocks.length;
  graph.blocks = graph.blocks.filter((id) => id !== targetUserId);
  if (graph.blocks.length !== before) {
    logger.info('User unblocked another user', { userId, targetUserId });
  }
}

export function hasBlocked(blockingUserId: string, blockedUserId: string): boolean {
  const graph = graphs.get(blockingUserId);
  if (!graph) return false;
  return graph.blocks.includes(blockedUserId);
}

export function getSocialGraph(userId: string): SocialGraph {
  return getOrCreateGraph(userId);
}

