import { logger } from '../core/logger';
import {
  ModerationCase,
  ModerationCaseStatus,
  ModerationReasonCategory,
} from '../types';

const casesById = new Map<string, ModerationCase>();
const casesByUserId = new Map<string, ModerationCase[]>();
const casesByMessageId = new Map<string, ModerationCase[]>();

interface CreateModerationCaseInput {
  reportedUserId: string;
  reportedMessageIds: string[];
  reportedByUserId: string;
  reasonCategories: ModerationReasonCategory[];
}

function createCaseId(): string {
  return `mc_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createModerationCase(input: CreateModerationCaseInput): ModerationCase {
  const id = createCaseId();
  const status: ModerationCaseStatus = 'OPEN';
  const now = Date.now();

  const moderationCase: ModerationCase = {
    id,
    reportedUserId: input.reportedUserId,
    reportedMessageIds: input.reportedMessageIds,
    reportedByUserIds: [input.reportedByUserId],
    reasonCategories: input.reasonCategories,
    status,
    createdAt: now,
  };

  casesById.set(id, moderationCase);

  const listForUser = casesByUserId.get(input.reportedUserId) ?? [];
  listForUser.push(moderationCase);
  casesByUserId.set(input.reportedUserId, listForUser);

  for (const messageId of input.reportedMessageIds) {
    const listForMessage = casesByMessageId.get(messageId) ?? [];
    listForMessage.push(moderationCase);
    casesByMessageId.set(messageId, listForMessage);
  }

  logger.warn('Moderation case created', {
    caseId: id,
    reportedUserId: input.reportedUserId,
    reportedMessageIds: input.reportedMessageIds,
    reasonCategories: input.reasonCategories,
  });

  return moderationCase;
}

export function getModerationCaseById(caseId: string): ModerationCase | undefined {
  return casesById.get(caseId);
}

export function getModerationCasesForUser(userId: string): ModerationCase[] {
  return casesByUserId.get(userId) ?? [];
}

export function getModerationCasesForMessage(messageId: string): ModerationCase[] {
  return casesByMessageId.get(messageId) ?? [];
}

