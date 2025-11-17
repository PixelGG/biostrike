import { AIDifficulty, Command, CommandType, MatchView } from './types';

export function chooseBotCommand(state: MatchView, difficulty: AIDifficulty): Command {
  const you = state.florans[0];
  const bot = state.florans[1];

  // If bot is already KO, do nothing meaningful.
  if (bot.hp <= 0) {
    return { type: CommandType.Attack, targetIndex: 0 };
  }

  const botWaterRatio = bot.capacity > 0 ? bot.currentWater / bot.capacity : 0;

  // Simple awareness layer: protect against imminent dehydration.
  if (botWaterRatio < 0.3) {
    return {
      type: CommandType.Item,
      targetIndex: 1,
      itemId: 'watering_can',
    };
  }

  // On higher difficulties, occasionally reduce transpiration in hot/dry weather.
  if (difficulty !== 'easy' && state.weather === 'HotDry') {
    const youWaterRatio = you.capacity > 0 ? you.currentWater / you.capacity : 0;
    if (botWaterRatio > 0.6 && youWaterRatio > 0.4) {
      return {
        type: CommandType.Item,
        targetIndex: 1,
        itemId: 'mulch',
      };
    }
  }

  // Default: basic attack on the player.
  return {
    type: CommandType.Attack,
    targetIndex: 0,
  };
}

