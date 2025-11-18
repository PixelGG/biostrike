import fs from 'fs';
import path from 'path';
import { Floran, FloranSpecies, FloranBaseStats, Resistances } from '../types';

const rs = (values: Resistances): Resistances => ({
  heat: values.heat,
  cold: values.cold,
  dry: values.dry,
  wet: values.wet,
  wind: values.wind,
  salt: values.salt,
});

const bs = (values: FloranBaseStats): FloranBaseStats => ({
  hp: values.hp,
  capacity: values.capacity,
  surface: values.surface,
  initiative: values.initiative,
  offense: values.offense,
  defense: values.defense,
});

const baseFlorans: FloranSpecies[] = [
  {
    id: 'sunflower',
    name: 'Sonnenblume',
    role: 'offense',
    biomeType: 'temperate',
    baseStats: bs({
      hp: 90,
      capacity: 90,
      surface: 1.5,
      initiative: 80,
      offense: 70,
      defense: 50,
    }),
    resistances: rs({
      heat: 0.6,
      cold: 0.45,
      wind: 0.45,
      dry: 0.55,
      wet: 0.5,
      salt: 0.5,
    } as Resistances),
    skillIds: ['sun_blade'],
  },
  {
    id: 'cactus',
    name: 'Kaktus',
    role: 'tank',
    biomeType: 'desert',
    baseStats: bs({
      hp: 120,
      capacity: 130,
      surface: 0.9,
      initiative: 60,
      offense: 55,
      defense: 80,
    }),
    resistances: rs({
      heat: 0.85,
      cold: 0.45,
      wind: 0.55,
      dry: 0.9,
      wet: 0.35,
      salt: 0.5,
    } as Resistances),
    skillIds: ['thorn_burst', 'sap_storage'],
  },
  {
    id: 'aloe',
    name: 'Aloe',
    role: 'support',
    biomeType: 'desert',
    baseStats: bs({
      hp: 95,
      capacity: 110,
      surface: 1.0,
      initiative: 70,
      offense: 45,
      defense: 60,
    }),
    resistances: rs({
      heat: 0.8,
      cold: 0.5,
      wind: 0.55,
      dry: 0.8,
      wet: 0.4,
      salt: 0.5,
    } as Resistances),
  },
  {
    id: 'water_lily',
    name: 'Seerose',
    role: 'tank',
    biomeType: 'aquatic',
    baseStats: bs({
      hp: 110,
      capacity: 120,
      surface: 1.0,
      initiative: 55,
      offense: 50,
      defense: 80,
    }),
    resistances: rs({
      heat: 0.55,
      cold: 0.55,
      wind: 0.5,
      dry: 0.4,
      wet: 0.85,
      salt: 0.6,
    } as Resistances),
  },
  {
    id: 'bamboo',
    name: 'Bambus',
    role: 'speed',
    biomeType: 'temperate',
    baseStats: bs({
      hp: 85,
      capacity: 85,
      surface: 1.2,
      initiative: 120,
      offense: 65,
      defense: 45,
    }),
    resistances: rs({
      heat: 0.55,
      cold: 0.5,
      wind: 0.4,
      dry: 0.5,
      wet: 0.5,
      salt: 0.5,
    } as Resistances),
  },
  {
    id: 'sundew',
    name: 'Sonnentau',
    role: 'dot',
    biomeType: 'swamp',
    baseStats: bs({
      hp: 80,
      capacity: 100,
      surface: 1.2,
      initiative: 70,
      offense: 65,
      defense: 55,
    }),
    resistances: rs({
      heat: 0.55,
      cold: 0.55,
      wind: 0.5,
      dry: 0.45,
      wet: 0.7,
      salt: 0.5,
    } as Resistances),
  },
  {
    id: 'venus_flytrap',
    name: 'Venusfliegenfalle',
    role: 'control',
    biomeType: 'swamp',
    baseStats: bs({
      hp: 85,
      capacity: 95,
      surface: 1.1,
      initiative: 75,
      offense: 60,
      defense: 60,
    }),
    resistances: rs({
      heat: 0.55,
      cold: 0.55,
      wind: 0.5,
      dry: 0.45,
      wet: 0.7,
      salt: 0.5,
    } as Resistances),
  },
  {
    id: 'nettle',
    name: 'Brennnessel',
    role: 'dot',
    biomeType: 'temperate',
    baseStats: bs({
      hp: 80,
      capacity: 90,
      surface: 1.0,
      initiative: 90,
      offense: 65,
      defense: 50,
    }),
    resistances: rs({
      heat: 0.6,
      cold: 0.55,
      wind: 0.5,
      dry: 0.5,
      wet: 0.5,
      salt: 0.5,
    } as Resistances),
  },
  {
    id: 'tomato',
    name: 'Tomate',
    role: 'burst',
    biomeType: 'temperate',
    baseStats: bs({
      hp: 85,
      capacity: 95,
      surface: 1.0,
      initiative: 85,
      offense: 75,
      defense: 50,
    }),
    resistances: rs({
      heat: 0.55,
      cold: 0.5,
      wind: 0.45,
      dry: 0.45,
      wet: 0.5,
      salt: 0.5,
    } as Resistances),
  },
];

interface DesignFloranStats {
  hp: number;
  cap: number;
  area: number;
  init: number;
  off: number;
  def: number;
}

interface DesignFloranResists {
  heat: number;
  cold: number;
  wind: number;
  dry: number;
  wet: number;
  salt: number;
}

interface DesignFloran {
  id: string;
  name: string;
  type?: string;
  signatures?: string[];
  baseStats: DesignFloranStats;
  resists: DesignFloranResists;
}

function clampResist(value: number): number {
  const normalized = value / 100;
  return Math.max(0, Math.min(0.85, normalized));
}

function mapDesignFloran(design: DesignFloran): FloranSpecies {
  let biomeType: string | undefined;
  let role: string | undefined;
  if (design.type) {
    const parts = design.type.split('/');
    if (parts.length >= 1) {
      biomeType = parts[0];
    }
    if (parts.length >= 2) {
      role = parts[1];
    }
  }

  const resistances: Resistances = rs({
    heat: clampResist(design.resists.heat),
    cold: clampResist(design.resists.cold),
    dry: clampResist(design.resists.dry),
    wet: clampResist(design.resists.wet),
    wind: clampResist(design.resists.wind),
    salt: clampResist(design.resists.salt),
  } as Resistances);

  const skillIds: string[] = [];

  const signatureSkillsByName: Record<string, string> = {
    Blattspreizung: 'sun_blade',
    'Saftspeicher': 'sap_storage',
    'Gel-Heilung': 'gel_heal',
    Schnappfalle: 'snap_trap',
    Klebtröpfchen: 'sticky_drops',
    'Spross-Schub': 'sprout_dash',
    Schwimmblätter: 'floating_leaves',
    Reinigung: 'cleanse_bloom',
    Tiefwurzel: 'deep_root',
    Zuckerstoß: 'sugar_rush',
    Leichtblatt: 'light_leaf',
    Hängetriebe: 'hanging_branches',
    Duftwolke: 'scent_cloud',
    Öle: 'oil_coating',
    Dornenkranz: 'thorn_crown',
    Nesselgift: 'nettle_venom',
    Schale: 'pumpkin_shell',
    Fruchtwurf: 'fruit_toss',
    Capsaicin: 'capsaicin_burn',
    Kühlduft: 'cool_breeze',
    Wasserfilm: 'water_film',
    Sporenfächer: 'spore_drift',
    Epiphyt: 'epiphyte_anchor',
    Rosette: 'rosette_shield',
    Faserdorn: 'fiber_spine',
    Steifblatt: 'stiff_leaf',
    Salzfilter: 'salt_filter_aura',
    Wedelspiel: 'frond_dance',
    Blütenflut: 'bloom_flood',
    Glücksklee: 'lucky_clover',
    Immunstimulanz: 'immune_boost',
    Beruhigen: 'soothe',
    'Aroma-Push': 'aroma_push',
    Knolle: 'tuber_guard',
    Überschwemmungsdrang: 'flood_drive',
    Hochwuchs: 'high_growth',
    Ährensturm: 'ear_storm',
    Glochiden: 'glochids',
    Schutzbusch: 'protect_bush',
    Ölduft: 'oil_scent',
    'Uralt-Erbe': 'ancient_heritage',
  };

  if (design.signatures && Array.isArray(design.signatures)) {
    for (const sig of design.signatures) {
      const id = signatureSkillsByName[sig];
      if (id) {
        skillIds.push(id);
      }
    }
  }

  return {
    id: design.id,
    name: design.name,
    role,
    biomeType,
    baseStats: bs({
      hp: design.baseStats.hp,
      capacity: design.baseStats.cap,
      surface: design.baseStats.area,
      initiative: design.baseStats.init,
      offense: design.baseStats.off,
      defense: design.baseStats.def,
    }),
    resistances,
    skillIds: skillIds.length > 0 ? skillIds : undefined,
  };
}

function loadAdditionalFloransFromJson(): FloranSpecies[] {
  try {
    const jsonPath = path.resolve(process.cwd(), '../client/plants.json');
    if (!fs.existsSync(jsonPath)) {
      return [];
    }
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    const data = JSON.parse(raw) as DesignFloran[];
    const existingIds = new Set(baseFlorans.map((f) => f.id));
    const additional: FloranSpecies[] = [];
    for (const entry of data) {
      if (!entry || !entry.id || existingIds.has(entry.id)) continue;
      additional.push(mapDesignFloran(entry));
    }
    return additional;
  } catch {
    return [];
  }
}

export const floranSpecies: FloranSpecies[] = [
  ...baseFlorans,
  ...loadAdditionalFloransFromJson(),
];

export function createFloranInstance(speciesId: string): Floran {
  const species =
    floranSpecies.find((s) => s.id === speciesId) ?? floranSpecies[0];

  return {
    id: species.id,
    name: species.name,
    stats: {
      hp: species.baseStats.hp,
      maxHp: species.baseStats.hp,
      capacity: species.baseStats.capacity,
      currentWater: species.baseStats.capacity,
      surface: species.baseStats.surface,
      initiative: species.baseStats.initiative,
      offense: species.baseStats.offense,
      defense: species.baseStats.defense,
      resistances: species.resistances,
    },
    overWaterStacks: 0,
    rootRot: false,
    statuses: [],
    activeItemEffects: {},
  };
}

export const sampleFlorans: Floran[] = [
  createFloranInstance('sunflower'),
  createFloranInstance('cactus'),
];
