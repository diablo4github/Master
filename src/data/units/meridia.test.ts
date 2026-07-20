import { describe, expect, it } from 'vitest';
import { MERIDIA_UNITS } from './meridia';
import { RACES } from '../races';
import type { AbilityDef } from '../../sim/types';

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const ALLOWED_ABILITY_TYPES: ReadonlySet<AbilityDef['type']> = new Set([
  'flying',
  'first-strike',
  'charge',
  'poison',
  'regeneration',
  'fear',
  'inspire',
  'holy-aura',
  'life-drain',
  'breath-weapon',
  'trample',
  'undead',
  'fearless',
  'pack-hunter',
]);

const LEGACY_IDS = new Set(['orc-warrior', 'human-spearman']);

/** Every Meridia race id mapped to the kebab-case singular prefix its unit ids must use. */
const RACE_UNIT_PREFIX: Record<string, string> = {
  orcs: 'orc',
  humans: 'human',
  dwarves: 'dwarf',
  'high-elves': 'high-elf',
  'wood-elves': 'wood-elf',
  'dusk-elves': 'dusk-elf',
  halflings: 'halfling',
  lizardfolk: 'lizardfolk',
  gnolls: 'gnoll',
  beastkin: 'beastkin',
  draconians: 'draconian',
  nomads: 'nomad',
  barbarians: 'barbarian',
  chitinfolk: 'chitinfolk',
  gnomes: 'gnome',
  ogres: 'ogre',
  centaurfolk: 'centaur',
  tidefolk: 'tidefolk',
};

const MERIDIA_RACE_IDS = Object.keys(RACE_UNIT_PREFIX);

const units = Object.values(MERIDIA_UNITS);
const militia = { figures: 6, hits: 3, damage: 2 }; // core.ts militia anchor
const militiaProduct = militia.figures * militia.hits * militia.damage; // 36

describe('meridia units', () => {
  it('covers exactly the 18 Meridia races, each with 4-5 units', () => {
    expect(MERIDIA_RACE_IDS).toHaveLength(18);
    for (const raceId of MERIDIA_RACE_IDS) {
      expect(RACES[raceId], raceId).toBeDefined();
      expect(RACES[raceId]?.homeWorld, raceId).toBe('meridia');
    }

    const byRace = new Map<string, number>();
    for (const unit of units) {
      if (!('race' in unit.origin)) continue;
      byRace.set(unit.origin.race, (byRace.get(unit.origin.race) ?? 0) + 1);
    }

    for (const raceId of MERIDIA_RACE_IDS) {
      const count = byRace.get(raceId) ?? 0;
      expect(count, `${raceId} unit count`).toBeGreaterThanOrEqual(4);
      expect(count, `${raceId} unit count`).toBeLessThanOrEqual(5);
    }
  });

  it('keeps the legacy ids orc-warrior and human-spearman', () => {
    expect(MERIDIA_UNITS['orc-warrior']).toBeDefined();
    expect(MERIDIA_UNITS['human-spearman']).toBeDefined();
  });

  it('keys MERIDIA_UNITS by each unit\'s own id', () => {
    for (const [key, unit] of Object.entries(MERIDIA_UNITS)) {
      expect(unit.id).toBe(key);
    }
  });

  it('uses lowercase kebab-case ids', () => {
    for (const unit of units) {
      expect(unit.id, unit.id).toMatch(KEBAB_CASE);
    }
  });

  it('gives every unit an origin.race that is a real Meridia race', () => {
    for (const unit of units) {
      expect('race' in unit.origin, unit.id).toBe(true);
      if (!('race' in unit.origin)) continue;
      expect(RACES[unit.origin.race], `${unit.id} -> ${unit.origin.race}`).toBeDefined();
      expect(RACES[unit.origin.race]?.homeWorld, unit.id).toBe('meridia');
      expect(MERIDIA_RACE_IDS, unit.id).toContain(unit.origin.race);
    }
  });

  it('prefixes every unit id with its race\'s singular form (legacy ids exempt)', () => {
    for (const unit of units) {
      if (LEGACY_IDS.has(unit.id)) continue;
      if (!('race' in unit.origin)) continue;
      const prefix = RACE_UNIT_PREFIX[unit.origin.race];
      expect(prefix, unit.origin.race).toBeDefined();
      expect(unit.id.startsWith(`${prefix}-`), `${unit.id} should start with "${prefix}-"`).toBe(
        true,
      );
    }
  });

  it('keeps figures, hits, melee.damage, speed, and mass strictly positive', () => {
    for (const unit of units) {
      expect(unit.combat.figures, unit.id).toBeGreaterThan(0);
      expect(unit.combat.hits, unit.id).toBeGreaterThan(0);
      expect(unit.combat.melee.damage, unit.id).toBeGreaterThan(0);
      expect(unit.combat.speed, unit.id).toBeGreaterThan(0);
      expect(unit.combat.mass, unit.id).toBeGreaterThan(0);
    }
  });

  it('only ever uses reach 1 or 2', () => {
    for (const unit of units) {
      expect([1, 2], unit.id).toContain(unit.combat.melee.reach);
    }
  });

  it('gives every ranged block range >= 3 and ammo > 0', () => {
    for (const unit of units) {
      if (!unit.combat.ranged) continue;
      expect(unit.combat.ranged.range, unit.id).toBeGreaterThanOrEqual(3);
      expect(unit.combat.ranged.ammo, unit.id).toBeGreaterThan(0);
    }
  });

  it('uses only the typed ability vocabulary', () => {
    for (const unit of units) {
      for (const ability of unit.abilities) {
        expect(ALLOWED_ABILITY_TYPES.has(ability.type), `${unit.id} -> ${ability.type}`).toBe(
          true,
        );
      }
    }
  });

  it('keeps power-cost sane: figures*hits*melee.damage <= 6x militia unless cost >= 100', () => {
    for (const unit of units) {
      const product = unit.combat.figures * unit.combat.hits * unit.combat.melee.damage;
      if (product > 6 * militiaProduct) {
        expect(unit.cost ?? 0, `${unit.id} product=${product}`).toBeGreaterThanOrEqual(100);
      }
    }
  });

  it('caps breath-weapon at one unit per race', () => {
    const byRace = new Map<string, number>();
    for (const unit of units) {
      if (!('race' in unit.origin)) continue;
      const hasBreath = unit.abilities.some((a) => a.type === 'breath-weapon');
      if (!hasBreath) continue;
      byRace.set(unit.origin.race, (byRace.get(unit.origin.race) ?? 0) + 1);
    }
    for (const [raceId, count] of byRace) {
      expect(count, raceId).toBeLessThanOrEqual(1);
    }
  });

  it('gives every unit a non-empty description', () => {
    for (const unit of units) {
      expect(unit.description.trim().length, unit.id).toBeGreaterThan(0);
    }
  });
});
