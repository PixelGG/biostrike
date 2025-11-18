import fs from 'fs';
import path from 'path';
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
  | 'reserve_water'
  | 'cleanse'
  | 'vision_weather'
  | 'vision_water'
  | 'summon_seedling'
  | 'cap_increase'
  | 'catch_attempt';

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

const baseItems: Item[] = [
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

interface DesignItem {
  id: string;
  name: string;
  effectKey: string;
  params: { [key: string]: number | boolean };
}

function inferCategory(effectKey: string): ItemCategory {
  switch (effectKey) {
    case 'water_instant':
    case 'water_precise':
    case 'heal_and_water':
    case 'cap_increase':
      return 'instant';
    case 'transp_reduce':
    case 'rootrot_progress_reduce':
    case 'phys_boost':
    case 'ps_boost':
    case 'no_sunburn':
    case 'cold_nullify_ps_boost':
    case 'leaf_loss_reduce':
    case 'salt_neutralize':
    case 'cleanse':
      return 'preStatus';
    case 'reserve_water':
    case 'vision_weather':
    case 'vision_water':
    case 'summon_seedling':
    case 'catch_attempt':
      return 'utility';
    default:
      return 'instant';
  }
}

function inferRarity(id: string): Item['rarity'] {
  if (id.startsWith('bannkern_4')) return 'epic';
  if (id.startsWith('bannkern_3')) return 'rare';
  if (id.startsWith('bannkern_2')) return 'rare';
  if (id.startsWith('bannkern_1')) return 'uncommon';
  return 'common';
}

function loadAdditionalItemsFromJson(): Item[] {
  try {
    const jsonPath = path.resolve(process.cwd(), '../client/items.json');
    if (!fs.existsSync(jsonPath)) {
      return [];
    }
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw) as DesignItem[];

    const existingIds = new Set(baseItems.map((i) => i.id));
    const additional: Item[] = [];

    for (const entry of data) {
      if (!entry || !entry.id || existingIds.has(entry.id)) continue;

      additional.push({
        id: entry.id,
        name: entry.name,
        rarity: inferRarity(entry.id),
        category: inferCategory(entry.effectKey),
        effectKey: entry.effectKey as ItemEffectKey,
        // For now, use the design parameters directly; engine logic will interpret
        // subsets of these for future effects.
        params: entry.params,
      });
    }

    return additional;
  } catch {
    return [];
  }
}

export const items: Item[] = [...baseItems, ...loadAdditionalItemsFromJson()];
