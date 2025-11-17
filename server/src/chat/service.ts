import { logger } from '../core/logger';
import {
  ChatChannel,
  ChatChannelType,
  ChatChannelVisibility,
  ChatMessage,
  ChatMessageFlag,
  ChatMessageModerationState,
} from '../types';

const LOBBY_CHANNEL_ID = 'lobby:global';
const MAX_MESSAGES_PER_CHANNEL = 200;

const channels = new Map<string, ChatChannel>();
const channelMembers = new Map<string, Set<string>>();
const userJoinedChannels = new Map<string, Set<string>>();
const messagesByChannel = new Map<string, ChatMessage[]>();
const messagesById = new Map<string, ChatMessage>();

export const LOBBY_GLOBAL_CHANNEL_ID = LOBBY_CHANNEL_ID;

function createChannelIdForMatch(matchId: string): string {
  return `match:${matchId}`;
}

function createChannel(
  id: string,
  type: ChatChannelType,
  visibility: ChatChannelVisibility,
  participantUserIds?: string[],
): ChatChannel {
  const existing = channels.get(id);
  if (existing) {
    return existing;
  }

  const channel: ChatChannel = {
    id,
    type,
    visibility,
    participantUserIds,
  };
  channels.set(id, channel);
  if (!channelMembers.has(id)) {
    channelMembers.set(id, new Set(participantUserIds ?? []));
  }
  if (!messagesByChannel.has(id)) {
    messagesByChannel.set(id, []);
  }

  logger.info('Chat channel created', { id, type, visibility });

  return channel;
}

function ensureLobbyChannel(): ChatChannel {
  let channel = channels.get(LOBBY_CHANNEL_ID);
  if (!channel) {
    channel = createChannel(LOBBY_CHANNEL_ID, 'LOBBY', 'PUBLIC');
  }
  return channel;
}

// Initialise default channels on module load.
ensureLobbyChannel();

export function ensureMatchChannel(matchId: string, participantUserIds: string[]): string {
  const id = createChannelIdForMatch(matchId);
  const channel = createChannel(id, 'MATCH', 'RESTRICTED', participantUserIds);

  const members = channelMembers.get(id);
  if (members) {
    for (const userId of participantUserIds) {
      members.add(userId);
      let userSet = userJoinedChannels.get(userId);
      if (!userSet) {
        userSet = new Set<string>();
        userJoinedChannels.set(userId, userSet);
      }
      userSet.add(id);
    }
  }

  return channel.id;
}

export function joinChannel(userId: string, channelId: string): ChatChannel {
  const channel = channels.get(channelId);
  if (!channel) {
    throw new Error('CHAT_CHANNEL_NOT_FOUND');
  }

  let members = channelMembers.get(channelId);
  if (!members) {
    members = new Set<string>();
    channelMembers.set(channelId, members);
  }
  members.add(userId);

  let userSet = userJoinedChannels.get(userId);
  if (!userSet) {
    userSet = new Set<string>();
    userJoinedChannels.set(userId, userSet);
  }
  userSet.add(channelId);

  logger.info('User joined chat channel', { userId, channelId });

  return channel;
}

export function leaveChannel(userId: string, channelId: string): void {
  const members = channelMembers.get(channelId);
  if (members) {
    members.delete(userId);
  }

  const userSet = userJoinedChannels.get(userId);
  if (userSet) {
    userSet.delete(channelId);
    if (userSet.size === 0) {
      userJoinedChannels.delete(userId);
    }
  }

  logger.info('User left chat channel', { userId, channelId });
}

export function isUserInChannel(userId: string, channelId: string): boolean {
  const members = channelMembers.get(channelId);
  return members ? members.has(userId) : false;
}

export function getChannelMembers(channelId: string): Set<string> {
  const members = channelMembers.get(channelId);
  return members ? new Set(members) : new Set<string>();
}

export function getChannelById(channelId: string): ChatChannel | undefined {
  return channels.get(channelId);
}

export interface SendChatMessageInput {
  channelId: string;
  senderUserId: string;
  content: string;
}

export interface SendChatMessageResult {
  message: ChatMessage;
  /**
   * Whether this message should be delivered to all channel members.
   * If false, callers may choose to deliver only to the sender (shadow mode).
   */
  deliverToChannelMembers: boolean;
}

function createMessageId(): string {
  return `cm_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

interface FilterResult {
  filteredContent: string;
  flags: ChatMessageFlag[];
  moderationState: ChatMessageModerationState;
  deliverToChannelMembers: boolean;
}

function applyFilters(content: string, channel: ChatChannel): FilterResult {
  let filteredContent = content;
  const flags: ChatMessageFlag[] = [];
  let moderationState: ChatMessageModerationState = 'VISIBLE';
  let deliverToChannelMembers = true;

  const normalized = content.toLowerCase();

  // Very small, placeholder profanity list; can be replaced with
  // data-driven filters or external services later.
  const profanityList = ['fuck', 'shit', 'bitch', 'idiot', 'asshole'];
  for (const word of profanityList) {
    if (normalized.includes(word)) {
      flags.push('PROFANITY');
      const regex = new RegExp(word, 'gi');
      filteredContent = filteredContent.replace(regex, '***');
    }
  }

  // Simple spam detection: extremely long repeated character sequences.
  const spamPattern = /(.)\1{7,}/;
  if (spamPattern.test(content)) {
    flags.push('SPAM');
    moderationState = 'SOFT_HIDDEN';
    deliverToChannelMembers = false;
  }

  // Basic link check; channels can decide to disallow links.
  const linkPattern = /(https?:\/\/|www\.)/i;
  if (linkPattern.test(content) && channel.rules && channel.rules.allowLinks === false) {
    flags.push('OTHER');
    moderationState = 'SOFT_HIDDEN';
    deliverToChannelMembers = false;
  }

  return {
    filteredContent,
    flags,
    moderationState,
    deliverToChannelMembers,
  };
}

export function sendChatMessage(input: SendChatMessageInput): SendChatMessageResult {
  const { channelId, senderUserId } = input;
  const raw = input.content ?? '';
  const trimmed = raw.trim();

  if (!trimmed) {
    throw new Error('CHAT_MESSAGE_EMPTY');
  }
  if (trimmed.length > 500) {
    throw new Error('CHAT_MESSAGE_TOO_LONG');
  }

  const channel = channels.get(channelId);
  if (!channel) {
    throw new Error('CHAT_CHANNEL_NOT_FOUND');
  }

  // For lobby channels we auto-join on first send; for restricted channels
  // the user must be registered as a participant.
  if (channel.type === 'LOBBY') {
    if (!isUserInChannel(senderUserId, channelId)) {
      joinChannel(senderUserId, channelId);
    }
  } else if (!isUserInChannel(senderUserId, channelId)) {
    throw new Error('CHAT_NOT_IN_CHANNEL');
  }

  const { filteredContent, flags, moderationState, deliverToChannelMembers } = applyFilters(
    trimmed,
    channel,
  );

  const message: ChatMessage = {
    id: createMessageId(),
    channelId,
    senderUserId,
    content: filteredContent,
    createdAt: Date.now(),
    normalizedContent: filteredContent.toLowerCase(),
    toxicityScore: undefined,
    flags,
    moderationState,
  };

  messagesById.set(message.id, message);

  let list = messagesByChannel.get(channelId);
  if (!list) {
    list = [];
    messagesByChannel.set(channelId, list);
  }
  list.push(message);

  if (list.length > MAX_MESSAGES_PER_CHANNEL) {
    const overflow = list.splice(0, list.length - MAX_MESSAGES_PER_CHANNEL);
    for (const m of overflow) {
      messagesById.delete(m.id);
    }
  }

  logger.info('Chat message accepted', {
    channelId,
    senderUserId,
    flags,
    moderationState,
  });

  return { message, deliverToChannelMembers };
}

export function getMessageById(messageId: string): ChatMessage | undefined {
  return messagesById.get(messageId);
}

export function flagMessageForModeration(
  messageId: string,
  additionalFlags: ChatMessageFlag[],
  newState?: ChatMessageModerationState,
): ChatMessage | undefined {
  const msg = messagesById.get(messageId);
  if (!msg) {
    return undefined;
  }

  const uniqueFlags = new Set<ChatMessageFlag>([...msg.flags, ...additionalFlags]);
  msg.flags = Array.from(uniqueFlags);

  if (newState) {
    msg.moderationState = newState;
  }

  logger.info('Chat message flagged for moderation', {
    messageId,
    flags: msg.flags,
    moderationState: msg.moderationState,
  });

  return msg;
}

