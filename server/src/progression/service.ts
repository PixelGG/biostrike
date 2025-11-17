import { logger } from '../core/logger';
import {
  MatchMode,
  PlayerProgressionProfile,
} from '../types';

const MAX_LEVEL = 30;

const profiles = new Map<string, PlayerProgressionProfile>();

function xpRequiredForLevel(level: number): number {
  // Simple approximated curve: 40 * level^1.4 (rounded).
  const base = 40 * Math.pow(level, 1.4);
  return Math.round(base);
}

export function getProgressionProfile(userId: string): PlayerProgressionProfile {
  const existing = profiles.get(userId);
  if (existing) {
    return existing;
  }

  const profile: PlayerProgressionProfile = {
    userId,
    playerLevel: 1,
    currentXp: 0,
    xpToNextLevel: xpRequiredForLevel(1),
    perkPoints: 0,
    perksTaken: [],
  };
  profiles.set(userId, profile);
  return profile;
}

export interface XpAwardContext {
  mode: MatchMode;
  isWinner: boolean;
  durationSeconds: number;
}

export interface XpAwardResult {
  before: PlayerProgressionProfile;
  after: PlayerProgressionProfile;
  gainedXp: number;
  levelUps: number;
}

export function awardXp(
  userId: string,
  ctx: XpAwardContext,
): XpAwardResult {
  const profile = getProgressionProfile(userId);
  const before: PlayerProgressionProfile = { ...profile };

  // Very simple base XP formula for the prototype.
  const base = ctx.mode === 'PVE_BOT' ? 40 : 50;
  const winBonus = ctx.isWinner ? 1.2 : 0.7;
  const durationFactor = Math.min(1.5, Math.max(0.5, ctx.durationSeconds / 300));

  let gainedXp = Math.round(base * winBonus * durationFactor);

  let levelUps = 0;

  while (gainedXp > 0 && profile.playerLevel < MAX_LEVEL) {
    const remainingToLevel = profile.xpToNextLevel - profile.currentXp;
    if (gainedXp >= remainingToLevel) {
      // Level up.
      gainedXp -= remainingToLevel;
      profile.playerLevel += 1;
      profile.currentXp = 0;
      profile.xpToNextLevel = profile.playerLevel <= MAX_LEVEL
        ? xpRequiredForLevel(profile.playerLevel)
        : 0;
      profile.perkPoints += 1;
      profile.lastLevelUpTimestamp = Date.now();
      levelUps += 1;

      logger.info('Player leveled up', {
        userId,
        level: profile.playerLevel,
      });
    } else {
      profile.currentXp += gainedXp;
      gainedXp = 0;
    }
  }

  profiles.set(userId, profile);

  return {
    before,
    after: { ...profile },
    gainedXp,
    levelUps,
  };
}

