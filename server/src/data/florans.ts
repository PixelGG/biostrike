import { Floran } from '../types';

export const sampleFlorans: Floran[] = [
  {
    id: 'floran1',
    name: 'Sprout',
    stats: {
      hp: 100,
      capacity: 50,
      currentWater: 50,
      surface: 1.0,
      initiative: 80,
      offense: 40,
      defense: 30,
      resistances: {
        heat: 0.2,
        cold: 0.2,
        dry: 0.3,
        wet: 0.1,
        wind: 0.2,
        salt: 0.2,
      },
    },
    overWaterStacks: 0,
    rootRot: false,
    statuses: [],
  },
  {
    id: 'floran2',
    name: 'Thorn',
    stats: {
      hp: 120,
      capacity: 60,
      currentWater: 60,
      surface: 1.2,
      initiative: 60,
      offense: 35,
      defense: 40,
      resistances: {
        heat: 0.3,
        cold: 0.1,
        dry: 0.2,
        wet: 0.2,
        wind: 0.3,
        salt: 0.1,
      },
    },
    overWaterStacks: 0,
    rootRot: false,
    statuses: [],
  },
];
