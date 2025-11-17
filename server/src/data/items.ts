import { Resistances } from '../types';

export type ItemCategory = 'instant' | 'preStatus' | 'preResolve' | 'utility';

export type ItemEffectKey =
  | 'water_instant'
  | 'water_precise'
  | 'heal_and_water'
  | 'transp_reduce'
  | 'phys_boost'
  | 'ps_boost'
  | 'rootrot_progress_reduce'
  | 'no_sunburn'
  | 'cold_nullify_ps_boost'
  | 'leaf_loss_reduce'
  | 'salt_neutralize'
  | 'reserve_water';

export interface ItemParams {
  [key: string]: number | boolean;
}

export interface Item {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  category: ItemCategory;
  effectKey: ItemEffectKey;
  params: ItemParams;
}

export const items: Item[] = [
  {
    id: 'watering_can',
    name: 'Gießkanne',
    rarity: 'common',
    category: 'instant',
    effectKey: 'water_instant',
    params: { value: 20, overflowStack: 0.5 },
  },
  {
    id: 'watering_wand',
    name: 'Gießstab',
    rarity: 'common',
    category: 'instant',
    effectKey: 'water_precise',
    params: { value: 15 },
  },
  {
    id: 'compost_tea',
    name: 'Komposttee-Kanne',
    rarity: 'uncommon',
    category: 'instant',
    effectKey: 'heal_and_water',
    params: { hpPct: 0.1, water: 10, nextInitPenalty: 0.05 },
  },
  {
    id: 'mulch',
    name: 'Mulch-Sack',
    rarity: 'uncommon',
    category: 'preStatus',
    effectKey: 'transp_reduce',
    params: { value: 0.3, duration: 3, initPenalty: 0.05 },
  },
  {
    id: 'fertilizer_pellets',
    name: 'Dünger-Pellets',
    rarity: 'uncommon',
    category: 'preStatus',
    effectKey: 'ps_boost',
    params: { value: 0.25, duration: 2, waterUse: 0.1 },
  },
  {
    id: 'drainage_gravel',
    name: 'Drainage-Kies',
    rarity: 'uncommon',
    category: 'preStatus',
    effectKey: 'rootrot_progress_reduce',
    params: { value: 0.5, duration: 3, rainPenalty: 0.2 },
  },
  {
    id: 'stake',
    name: 'Rankhilfe',
    rarity: 'uncommon',
    category: 'preResolve',
    effectKey: 'phys_boost',
    params: { damageBoost: 0.15, sizeBoost: 0.1, windVuln: 0.2 },
  },
  {
    id: 'pot_xl',
    name: 'Topf XL',
    rarity: 'rare',
    category: 'instant',
    effectKey: 'transp_reduce',
    params: { value: 0, capacityBonus: 30, initPenalty: 0.05 },
  },
  {
    id: 'shade_cloth',
    name: 'Schattentuch',
    rarity: 'uncommon',
    category: 'preStatus',
    effectKey: 'no_sunburn',
    params: { duration: 2, psPenalty: 0.15 },
  },
  {
    id: 'heat_lamp',
    name: 'Wärmelampe',
    rarity: 'uncommon',
    category: 'preStatus',
    effectKey: 'cold_nullify_ps_boost',
    params: { psBoost: 0.1, transpBoost: 0.1, duration: 2 },
  },
  {
    id: 'hydrogel_beads',
    name: 'Hydrogel-Perlen',
    rarity: 'rare',
    category: 'utility',
    effectKey: 'reserve_water',
    params: { value: 15, triggerBelowPct: 0.2, overflowStack: 1 },
  },
];

