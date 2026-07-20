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

// Regiment-scale doctrine bands (DESIGN.md Combat section).
const REGIMENT_MIN = 250;
const REGIMENT_MAX = 500;
const CAVALRY_MIN = 180;
const CAVALRY_MAX = 300;
const SWARM_MIN = 60;
const SWARM_MAX = 120;
const HULKING_MIN = 40;
const HULKING_MAX = 80;
const DEAD_ZONE_MIN = 3;
const DEAD_ZONE_MAX = 25;

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

describe('regiment-scale doctrine (DESIGN.md Combat)', () => {
  it('never leaves a unit in the old squad-scale dead zone (3-25 figures)', () => {
    for (const unit of units) {
      const f = unit.combat.figures;
      expect(f < DEAD_ZONE_MIN || f > DEAD_ZONE_MAX, `${unit.id} figures=${f}`).toBe(true);
    }
  });

  it('sizes foot/ranged regiments 250-500 figures at 1-2 hits (swarm/hulking units excluded by scale)', () => {
    for (const unit of units) {
      if (unit.role !== 'infantry' && unit.role !== 'ranged') continue;
      if (unit.combat.figures <= SWARM_MAX) continue; // swarm/hulking-scale racial units
      expect(unit.combat.figures, unit.id).toBeGreaterThanOrEqual(REGIMENT_MIN);
      expect(unit.combat.figures, unit.id).toBeLessThanOrEqual(REGIMENT_MAX);
      expect([1, 2], unit.id).toContain(unit.combat.hits);
    }
  });

  it('sizes cavalry 180-300 figures (swarm-scale pack cavalry excluded by scale)', () => {
    for (const unit of units) {
      if (unit.role !== 'cavalry') continue;
      if (unit.combat.figures <= SWARM_MAX) continue;
      expect(unit.combat.figures, unit.id).toBeGreaterThanOrEqual(CAVALRY_MIN);
      expect(unit.combat.figures, unit.id).toBeLessThanOrEqual(CAVALRY_MAX);
    }
  });

  it('sizes hulking companies (ogres) 40-80 figures at 8-15 hits', () => {
    for (const unit of units) {
      if (unit.combat.figures === 1) continue; // singular great monsters, not hulking companies
      if (unit.combat.hits < 8) continue;
      expect(unit.combat.figures, unit.id).toBeGreaterThanOrEqual(HULKING_MIN);
      expect(unit.combat.figures, unit.id).toBeLessThanOrEqual(HULKING_MAX);
      expect(unit.combat.hits, unit.id).toBeLessThanOrEqual(15);
    }
  });

  it('keeps swarm/pack units at 60-120 figures, 1-2 hits', () => {
    for (const unit of units) {
      if (unit.combat.figures < SWARM_MIN || unit.combat.figures > SWARM_MAX) continue;
      if (unit.combat.hits >= 8) continue; // hulking-scale company, not a swarm
      expect([1, 2], unit.id).toContain(unit.combat.hits);
    }
  });

  it('gives any singular unit (figures === 1) a big hit pool (>= 30)', () => {
    for (const unit of units) {
      if (unit.combat.figures !== 1) continue;
      expect(unit.combat.hits, unit.id).toBeGreaterThanOrEqual(30);
    }
  });
});
