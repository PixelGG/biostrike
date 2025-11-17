import { logger } from '../core/logger';
import {
  EventDefinition,
  EventInstance,
  EventInstanceState,
  EventType,
  LiveConfig,
  MatchMode,
  MatchResult,
  QuestDefinition,
  QuestInstance,
  QuestInstanceState,
  QuestProgress,
  Region,
} from '../types';
import { applyBcChange } from '../wallet/service';
import { awardXp } from '../progression/service';

const liveConfig: LiveConfig = {
  xpMultiplierByMode: {},
  bcMultiplierByMode: {},
};

export function getLiveConfig(): LiveConfig {
  return liveConfig;
}

// Simple in-memory definitions and instances for the prototype.

const eventDefinitions: EventDefinition[] = [
  {
    id: 'xp_weekend',
    type: 'XP_BOOST',
    name: 'XP-Wochenende',
    description: '+30 % XP in Casual und PvE.',
    allowedModes: ['PVE_BOT', 'PVP_CASUAL'],
    params: {
      xpMultiplier: 1.3,
    },
  },
  {
    id: 'bc_boost',
    type: 'BC_BOOST',
    name: 'BC-Bonus',
    description: '+20 % BC in allen Modi.',
    allowedModes: ['PVE_BOT', 'PVP_CASUAL', 'PVP_RANKED'],
    params: {
      bcMultiplier: 1.2,
    },
  },
];

const eventInstances: EventInstance[] = [];

const questDefinitions: QuestDefinition[] = [
  {
    id: 'daily_win_3',
    category: 'daily',
    name: 'Täglicher Sieg-Triple',
    description: 'Gewinne 3 Matches (alle Modi).',
    objectives: [
      {
        type: 'win_matches',
        targetValue: 3,
      },
    ],
    reward: {
      xp: 80,
      bc: 60,
    },
  },
];

const questInstances = new Map<string, QuestInstance[]>();

export function startLiveOpsScheduler(intervalMs = 5_000): void {
  // Create a default active XP/BC event instance for the prototype.
  if (eventInstances.length === 0) {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const defaultRegion: Region = 'EU';

    for (const def of eventDefinitions) {
      const instance: EventInstance = {
        id: `inst_${def.id}`,
        definitionId: def.id,
        state: 'active',
        region: defaultRegion,
        startsAt: now,
        endsAt: now + oneDayMs,
      };
      eventInstances.push(instance);
    }
    recomputeLiveConfig();
  }

  setInterval(() => {
    const now = Date.now();
    let changed = false;

    for (const instance of eventInstances) {
      if (instance.state === 'scheduled' && now >= instance.startsAt && now < instance.endsAt) {
        instance.state = 'active';
        changed = true;
        logger.info('Event instance activated', { instanceId: instance.id });
      } else if (instance.state === 'active' && now >= instance.endsAt) {
        instance.state = 'ended';
        changed = true;
        logger.info('Event instance ended', { instanceId: instance.id });
      }
    }

    if (changed) {
      recomputeLiveConfig();
    }
  }, intervalMs);
}

function recomputeLiveConfig(): void {
  liveConfig.xpMultiplierByMode = {};
  liveConfig.bcMultiplierByMode = {};

  const now = Date.now();

  for (const instance of eventInstances) {
    if (instance.state !== 'active' || instance.startsAt > now || instance.endsAt <= now) {
      continue;
    }
    const def = eventDefinitions.find((d) => d.id === instance.definitionId);
    if (!def) continue;

    const params = { ...(def.params ?? {}), ...(instance.runtimeParams ?? {}) };

    if (def.type === 'XP_BOOST') {
      const multiplier = Number(params.xpMultiplier ?? 1);
      (def.allowedModes ?? [])?.forEach((mode) => {
        const current = liveConfig.xpMultiplierByMode[mode] ?? 1;
        liveConfig.xpMultiplierByMode[mode] = current * multiplier;
      });
    } else if (def.type === 'BC_BOOST') {
      const multiplier = Number(params.bcMultiplier ?? 1);
      (def.allowedModes ?? [])?.forEach((mode) => {
        const current = liveConfig.bcMultiplierByMode[mode] ?? 1;
        liveConfig.bcMultiplierByMode[mode] = current * multiplier;
      });
    }
  }

  logger.info('LiveConfig recomputed', { liveConfig });
}

// Quest-related helpers: lightweight daily quest tracking for the prototype.

function getOrCreateQuestInstances(userId: string): QuestInstance[] {
  let list = questInstances.get(userId);
  if (!list) {
    list = [];
    questInstances.set(userId, list);
  }
  return list;
}

function ensureDailyQuests(userId: string): QuestInstance[] {
  const list = getOrCreateQuestInstances(userId);
  const existingIds = new Set(list.map((q) => q.questDefinitionId));

  for (const def of questDefinitions) {
    if (!existingIds.has(def.id)) {
      const progress: QuestProgress[] = def.objectives.map((_o, idx) => ({
        objectiveIndex: idx,
        currentValue: 0,
      }));
      const inst: QuestInstance = {
        id: `qinst_${def.id}_${userId}`,
        userId,
        questDefinitionId: def.id,
        state: 'available',
        progress,
        rewardClaimed: false,
      };
      list.push(inst);
    }
  }

  return list;
}

export function handleMatchResultForQuests(result: MatchResult): void {
  for (const player of result.players) {
    const list = ensureDailyQuests(player.userId);
    for (const inst of list) {
      if (inst.state === 'expired' || inst.rewardClaimed) continue;
      const def = questDefinitions.find((d) => d.id === inst.questDefinitionId);
      if (!def) continue;

      def.objectives.forEach((obj, idx) => {
        const prog = inst.progress.find((p) => p.objectiveIndex === idx);
        if (!prog) return;
        if (obj.type === 'win_matches' && player.isWinner) {
          prog.currentValue += 1;
        }
        if (prog.currentValue >= obj.targetValue) {
          // Objective complete; we mark overall quest as completed when all objectives satisfied.
          const allDone = inst.progress.every((p, i) => {
            const od = def.objectives[i];
            return p.currentValue >= od.targetValue;
          });
          if (allDone && inst.state !== 'completed' && !inst.rewardClaimed) {
            inst.state = 'completed';
            logger.info('Quest completed', { userId: player.userId, questId: def.id });

            // Auto-claim rewards for the prototype.
            if (def.reward.xp || def.reward.bc) {
              if (def.reward.xp) {
                awardXp(player.userId, {
                  mode: result.mode,
                  isWinner: true,
                  durationSeconds: result.durationSeconds,
                });
              }
              if (def.reward.bc) {
                applyBcChange(player.userId, def.reward.bc, `quest_${def.id}`);
              }
              inst.rewardClaimed = true;
              inst.state = 'claimed';
              logger.info('Quest reward claimed', { userId: player.userId, questId: def.id });
            }
          }
        }
      });
    }
  }
}

