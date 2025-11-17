// Core shared types for BioStrike server-side simulation

export enum MatchPhase {
  StartOfRound = 'StartOfRound',
  ApplyEnvironment = 'ApplyEnvironment',
  ApplyPassiveStatus = 'ApplyPassiveStatus',
  CommandPhase = 'CommandPhase',
  ResolutionPhase = 'ResolutionPhase',
  KOPhase = 'KOPhase',
  EndOfRound = 'EndOfRound',
}

export enum StatusType {
  Wilt = 'Wilt',
  RootRot = 'RootRot',
  Spores = 'Spores',
  Sunburn = 'Sunburn',
  Thorn = 'Thorn',
  LeafLoss = 'LeafLoss',
  BuffResistance = 'BuffResistance',
  BuffOffense = 'BuffOffense',
  BuffDefense = 'BuffDefense',
  BuffInitiative = 'BuffInitiative',
}

export enum WeatherType {
  HotDry = 'HotDry',
  CoolDry = 'CoolDry',
  LightRain = 'LightRain',
  HeavyRain = 'HeavyRain',
  Windy = 'Windy',
  Cloudy = 'Cloudy',
}

export enum CommandType {
  Attack = 'ATTACK',
  Skill = 'SKILL',
  Item = 'ITEM',
  Switch = 'SWITCH',
}

export enum KOReason {
  Hp = 'HP',
  Dehydration = 'DEHYDRATION',
  RootRot = 'ROOT_ROT',
}

export type AIDifficulty = 'easy' | 'normal' | 'hard';
export type MatchMode = 'PVE_BOT' | 'PVP_CASUAL' | 'PVP_RANKED';

export type Region = 'EU' | 'NA' | 'ASIA' | 'SA' | 'OC';

export enum SkillArchetype {
  DirectDamage = 'DirectDamage',
  DamageOverTime = 'DamageOverTime',
  Control = 'Control',
  Support = 'Support',
  Reflex = 'Reflex',
}

export enum DamageType {
  Physical = 'Physical',
  Heat = 'Heat',
  Cold = 'Cold',
  Spore = 'Spore',
  Water = 'Water',
  Neutral = 'Neutral',
}

export interface Resistances {
  heat: number;
  cold: number;
  dry: number;
  wet: number;
  wind: number;
  salt: number;
}

export interface Stats {
  /**
   * Current HP of the Floran.
   */
  hp: number;
  /**
   * Maximum HP used for percentage based effects.
   */
  maxHp: number;
  /**
   * Maximum water capacity of the Floran.
   */
  capacity: number;
  /**
   * Current water in the Floran's system.
   */
  currentWater: number;
  /**
   * Surface multiplier (approx. 0.8–1.6).
   */
  surface: number;
  /**
   * Initiative score for turn order.
   */
  initiative: number;
  /**
   * Offensive strength.
   */
  offense: number;
  /**
   * Defensive strength.
   */
  defense: number;
  /**
   * Elemental and environmental resistances (0–0.85).
   */
  resistances: Resistances;
}

export interface StatusEffect {
  type: StatusType;
  duration: number;
  stacks: number;
}

export interface ActiveItemEffects {
  /**
   * Reduces transpiration by a percentage for a limited number of rounds.
   * value: fraction (0.3 = 30 % Reduktion)
   */
  transpReduce?: {
    value: number;
    remainingRounds: number;
  };
}

export interface Floran {
  id: string;
  name: string;
  stats: Stats;
  overWaterStacks: number;
  rootRot: boolean;
  statuses: StatusEffect[];
  activeItemEffects?: ActiveItemEffects;
}

export interface FloranBaseStats {
  hp: number;
  capacity: number;
  surface: number;
  initiative: number;
  offense: number;
  defense: number;
}

export type SkillTarget =
  | 'Self'
  | 'Enemy'
  | 'Ally'
  | 'AllyOrSelf';

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  archetype: SkillArchetype;
  damageType: DamageType;
  target: SkillTarget;
  cooldown: number;
  /**
   * For direct damage skills: base power multiplier
   * applied on top of offense + PS bonus.
   */
  power?: number;
  /**
   * How strongly photosynthesis contributes to this skill.
   */
  psCoefficient?: number;
  /**
   * For DoT/control skills.
   */
  dotPctPerRound?: number;
  dotDuration?: number;
  /**
   * Initiative modification (positive = faster).
   */
  initiativeDelta?: number;
}

export interface FloranSpecies {
  id: string;
  name: string;
  role?: string;
  biomeType?: string;
  baseStats: FloranBaseStats;
  resistances: Resistances;
  skillIds?: string[];
}

export interface MatchLogEntry {
  round: number;
  phase: MatchPhase;
  message: string;
  details?: Record<string, unknown>;
}

export interface MatchViewFloran {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  currentWater: number;
  capacity: number;
  surface: number;
  initiative: number;
  offense: number;
  defense: number;
  resistances: Resistances;
  overWaterStacks: number;
  rootRot: boolean;
  statuses: StatusEffect[];
}

export interface MatchView {
  /**
   * Optional engine-level identifier for the match.
   * The transport already carries a matchId; this is useful for debugging and replays.
   */
  id?: string;
  mode?: MatchMode;
  arenaId?: string;
  seed?: number;
  round: number;
  phase: MatchPhase;
  weather: WeatherType;
  florans: [MatchViewFloran, MatchViewFloran];
  logs: MatchLogEntry[];
  isFinished: boolean;
  winnerIndex: 0 | 1 | null;
  koReason?: KOReason;
}

export interface Command {
  type: CommandType;
  targetIndex?: number;
  /**
   * Optional: item identifier when using CommandType.Item.
   */
  itemId?: string;
}

// Rating and matchmaking domain types.

export interface PlayerRating {
  mode: MatchMode;
  ratingValue: number;
  ratingUncertainty?: number;
}

export interface QueueEntry {
  userId: string;
  mode: MatchMode;
  region: Region;
  rating: PlayerRating;
  enqueueTime: number;
  // Additional constraints can be added later (preferred biome, party, etc.).
}

export interface MatchTicketPlayer {
  userId: string;
  rating: PlayerRating;
  side: 'A' | 'B';
}

export interface MatchTicket {
  id: string;
  mode: MatchMode;
  region: Region;
  players: MatchTicketPlayer[];
  createdAt: number;
}

// Progression and rewards domain types.

export interface PlayerProgressionProfile {
  userId: string;
  playerLevel: number;
  currentXp: number;
  xpToNextLevel: number;
  perkPoints: number;
  perksTaken: string[];
  lastLevelUpTimestamp?: number;
}

export interface CurrencyWallet {
  userId: string;
  biocredits: number;
}

export interface CurrencyTransaction {
  userId: string;
  delta: number;
  reason: string;
  at: number;
}

export interface FloranInstance {
  instanceId: string;
  speciesId: string;
  ownerId: string;
  level: number;
  xp: number;
  evolutionStage?: string;
}

export interface MatchResultPlayerSummary {
  userId: string;
  isWinner: boolean;
}

export interface MatchResult {
  matchId: string;
  mode: MatchMode;
  arenaId?: string;
  durationSeconds: number;
  state: MatchView;
  players: MatchResultPlayerSummary[];
}

export interface EnvelopeMeta {
  id: string;
  /**
   * Optional sequence number for ordering and resume semantics.
   */
  seq?: number;
  /**
   * ISO timestamp of when the sender created the message.
   */
  ts?: string;
}

// WebSocket payloads used between client and server.
export type ClientMessagePayload =
  | {
      type: 'auth/hello';
      payload: {
        token: string;
        // Optional future extension: existing sessionId for resume.
        sessionId?: string;
      };
    }
  | {
      type: 'match/queue';
      payload: {
        mode: MatchMode;
        speciesId?: string;
        difficulty?: AIDifficulty;
      };
    }
  | {
      type: 'match/cancelQueue';
      payload: {
        mode: MatchMode;
      };
    }
  | {
      type: 'match/command';
      payload: {
        matchId: string;
        command: Command;
      };
    }
  | {
      type: 'chat/send';
      payload: {
        channel: string;
        message: string;
      };
    }
  | {
      type: 'system/pong';
      payload: Record<string, never>;
    };

export type ClientMessage = EnvelopeMeta & ClientMessagePayload;

export type ServerMessagePayload =
  | {
      type: 'auth/ok';
      payload: { userId: string; sessionId: string };
    }
  | {
      type: 'auth/error';
      payload: { code: string; message: string };
    }
  | {
      type: 'match/queued';
      payload: { mode: MatchMode };
    }
  | {
      type: 'match/found';
      payload: {
        matchId: string;
        mode: MatchMode;
        opponent?: { userId: string };
      };
    }
  | {
      type: 'match/state';
      payload: {
        matchId: string;
        state: MatchView;
      };
    }
  | {
      type: 'match/result';
      payload: {
        matchId: string;
        state: MatchView;
      };
    }
  | {
      type: 'chat/message';
      payload: {
        channel: string;
        userId: string;
        message: string;
        at: string;
      };
    }
  | {
      type: 'error';
      payload: { code: string; message: string };
    }
  | {
      type: 'system/ping';
      payload: Record<string, never>;
    };

export type ServerMessage = EnvelopeMeta & ServerMessagePayload;
