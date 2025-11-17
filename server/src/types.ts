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

export interface Floran {
  id: string;
  name: string;
  stats: Stats;
  overWaterStacks: number;
  rootRot: boolean;
  statuses: StatusEffect[];
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
}

// WebSocket messages used between client and server for the vertical slice.
export type ClientMessage =
  | { type: 'start_match' }
  | { type: 'command'; payload: { command: Command } };

export type ServerMessage =
  | { type: 'welcome'; payload: { message: string } }
  | { type: 'match_state'; payload: MatchView }
  | { type: 'error'; payload: { message: string } };
