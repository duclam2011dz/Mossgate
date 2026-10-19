import type { Enemy, EnemyOverrides, EnemySpecies } from './contracts.ts';
export interface EnemyDefinition {
  name: string;
  flying: boolean;
  attack: 'melee' | 'spore' | 'charge' | 'thorn' | 'dive' | 'bloom';
  patrolSpeed: number;
  chaseSpeed: number;
  patrolRange: number;
  detectionRange: number;
  attackDamage: number;
  contactDamage: number;
  windup: number;
  cooldown: number;
  leash: number;
  w: number;
  h: number;
}
const ground = { flying: false, leash: 320, w: 14, h: 20 };
const flying = { flying: true, leash: 480, w: 16, h: 16 };
export const enemyDefinitions: Readonly<
  Record<EnemySpecies, Readonly<EnemyDefinition>>
> = {
  'bramble-guard': {
    ...ground,
    name: 'Bramble Guard',
    attack: 'melee',
    patrolSpeed: 32,
    chaseSpeed: 64,
    patrolRange: 256,
    detectionRange: 96,
    attackDamage: 35,
    contactDamage: 20,
    windup: 0.35,
    cooldown: 1.1,
  },
  'spore-pod': {
    ...ground,
    name: 'Spore Pod',
    attack: 'spore',
    patrolSpeed: 24,
    chaseSpeed: 48,
    patrolRange: 320,
    detectionRange: 112,
    attackDamage: 20,
    contactDamage: 15,
    windup: 0.4,
    cooldown: 1.35,
  },
  'root-charger': {
    ...ground,
    name: 'Root Charger',
    attack: 'charge',
    patrolSpeed: 30,
    chaseSpeed: 72,
    patrolRange: 256,
    detectionRange: 96,
    attackDamage: 45,
    contactDamage: 25,
    windup: 0.5,
    cooldown: 1.8,
  },
  'thorn-wisp': {
    ...flying,
    name: 'Thorn Wisp',
    attack: 'thorn',
    patrolSpeed: 32,
    chaseSpeed: 82,
    patrolRange: 96,
    detectionRange: 288,
    attackDamage: 25,
    contactDamage: 15,
    windup: 0.3,
    cooldown: 1,
  },
  'vine-moth': {
    ...flying,
    name: 'Vine Moth',
    attack: 'dive',
    patrolSpeed: 36,
    chaseSpeed: 90,
    patrolRange: 80,
    detectionRange: 256,
    attackDamage: 40,
    contactDamage: 20,
    windup: 0.4,
    cooldown: 1.5,
  },
  'bloom-sentinel': {
    ...flying,
    name: 'Bloom Sentinel',
    attack: 'bloom',
    patrolSpeed: 20,
    chaseSpeed: 60,
    patrolRange: 64,
    detectionRange: 320,
    attackDamage: 25,
    contactDamage: 15,
    windup: 0.5,
    cooldown: 1.8,
  },
};
export const enemyOverrideLimits: Readonly<
  Record<keyof EnemyOverrides, readonly [number, number]>
> = {
  patrolSpeed: [1, 150],
  chaseSpeed: [1, 180],
  detectionRange: [16, 640],
  attackDamage: [1, 100],
  contactDamage: [1, 100],
  cooldown: [0.3, 10],
  leash: [32, 960],
};
export function isEnemySpecies(value: unknown): value is EnemySpecies {
  return typeof value === 'string' && Object.hasOwn(enemyDefinitions, value);
}
export function enemyStats(enemy: Enemy): EnemyDefinition {
  return { ...enemyDefinitions[enemy.species], ...enemy.overrides };
}
