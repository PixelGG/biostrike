import { DamageType, SkillArchetype, SkillDefinition } from '../types';

export const skills: SkillDefinition[] = [
  {
    id: 'sun_blade',
    name: 'Blattspreizung',
    description: 'Starker Sonnen-beschleunigter Schlag mit hoher Offense-Skalierung.',
    archetype: SkillArchetype.DirectDamage,
    damageType: DamageType.Heat,
    target: 'Enemy',
    cooldown: 2,
    power: 1.4,
    psCoefficient: 0.8,
  },
  {
    id: 'thorn_burst',
    name: 'Dornenstoß',
    description: 'Physischer Stoß mit Dornen, der robusten Pflanzen Vorteile verschafft.',
    archetype: SkillArchetype.DirectDamage,
    damageType: DamageType.Physical,
    target: 'Enemy',
    cooldown: 2,
    power: 1.3,
    psCoefficient: 0.3,
  },
  {
    id: 'sap_storage',
    name: 'Saftspeicher',
    description: 'Reduziert vorübergehend die Transpiration, indem Wasser im Gewebe gebunden wird.',
    archetype: SkillArchetype.Support,
    damageType: DamageType.Neutral,
    target: 'Self',
    cooldown: 3,
    // Implementation: wirkt wie Mulch, siehe transp_reduce.
  },
  {
    id: 'gel_heal',
    name: 'Gel-Heilung',
    description: 'Aloe-Gel regeneriert HP und etwas Wasser.',
    archetype: SkillArchetype.Support,
    damageType: DamageType.Neutral,
    target: 'AllyOrSelf',
    cooldown: 3,
  },
  {
    id: 'spore_drift',
    name: 'Sporenfächer',
    description: 'Verteilt Sporen, die über Zeit Schaden zufügen.',
    archetype: SkillArchetype.DamageOverTime,
    damageType: DamageType.Spore,
    target: 'Enemy',
    cooldown: 3,
    dotPctPerRound: 0.08,
    dotDuration: 3,
  },
];

export function getSkillById(id: string | undefined): SkillDefinition | undefined {
  if (!id) return undefined;
  return skills.find((s) => s.id === id);
}

