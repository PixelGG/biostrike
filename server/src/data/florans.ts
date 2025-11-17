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

export const floranSpecies: FloranSpecies[] = [
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
  };
}

export const sampleFlorans: Floran[] = [
  createFloranInstance('sunflower'),
  createFloranInstance('cactus'),
];
