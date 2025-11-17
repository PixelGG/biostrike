// Type definitions and enums for BioStrike server

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

export interface Resistances {
  heat: number;
  cold: number;
  dry: number;
  wet: number;
  wind: number;
  salt: number;
}

export interface Stats {
  hp: number;
  capacity: number;
  currentWater: number;
  surface: number;
  initiative: number;
  offense: number;
  defense: number;
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

// Additional interfaces can be added for Items, Arena, Weather, MatchState etc.
