import { logger } from '../core/logger';
import {
  MatchMode,
  MatchResult,
} from '../types';
import {
  awardXp,
  XpAwardContext,
  XpAwardResult,
} from '../progression/service';
import {
  applyBcChange,
  BcChangeResult,
} from '../wallet/service';
import { getLiveConfig } from '../liveops/service';
import { incrementCounter } from '../observability/metrics';
import { trackEvent } from '../observability/telemetry';

export interface RewardSummary {
  userId: string;
  xp: XpAwardResult;
  bc: BcChangeResult;
}

function computeBaseBcReward(
  mode: MatchMode,
  isWinner: boolean,
  durationSeconds: number,
): number {
  const base =
    mode === 'PVE_BOT'
      ? isWinner ? 30 : 15
      : isWinner ? 40 : 20;

  const durationFactor = Math.min(1.5, Math.max(0.5, durationSeconds / 300));

  const liveConfig = getLiveConfig();
  const liveMultiplier = liveConfig.bcMultiplierByMode[mode] ?? 1;

  const value = Math.round(base * durationFactor * liveMultiplier);

  return value;
}

export function processMatchResult(result: MatchResult): RewardSummary[] {
  const { matchId, mode, durationSeconds, players } = result;

  const summaries: RewardSummary[] = [];

  for (const player of players) {
    const xpCtx: XpAwardContext = {
      mode,
      isWinner: player.isWinner,
      durationSeconds,
    };
    const xpResult = awardXp(player.userId, xpCtx);

    const bcDelta = computeBaseBcReward(mode, player.isWinner, durationSeconds);
    const bcResult = applyBcChange(
      player.userId,
      bcDelta,
      `match_${mode.toLowerCase()}_${matchId}`,
    );

    summaries.push({
      userId: player.userId,
      xp: xpResult,
      bc: bcResult,
    });
  }

  logger.info('Match rewards processed', {
    matchId,
    mode,
    rewards: summaries.map((s) => ({
      userId: s.userId,
      xpGained: s.xp.gainedXp,
      level: s.xp.after.playerLevel,
      bcDelta: s.bc.after.biocredits - s.bc.before.biocredits,
    })),
  });

  incrementCounter('match_results_total', 1, { mode });
  trackEvent('MatchEnded', {
    matchId,
    mode,
    durationSeconds,
    players: players.map((p) => ({
      userId: p.userId,
      isWinner: p.isWinner,
    })),
  });

  return summaries;
}
