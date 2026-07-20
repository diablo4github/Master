import { describe, expect, it } from 'vitest';
import { CREATURE_UNITS } from './creatures';
import type { AbilityDef, SchoolId, UnitDef } from '../../sim/types';

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SCHOOL_IDS: readonly SchoolId[] = ['life', 'death', 'chaos', 'nature', 'sorcery'];

const ABILITY_VALIDATORS: Record<AbilityDef['type'], (a: AbilityDef) => void> = {
  flying: () => {},
  'first-strike': () => {},
  charge: (a) => {
    expect((a as { bonus: number }).bonus).toBeGreaterThan(0);
  },
  poison: (a) => {
    expect((a as { strength: number }).strength).toBeGreaterThan(0);
  },
  regeneration: (a) => {
    expect((a as { perTick: number }).perTick).toBeGreaterThan(0);
  },
  fear: (a) => {
    expect((a as { radius: number }).radius).toBeGreaterThan(0);
  },
  inspire: (a) => {
    const i = a as { radius: number; bonus: number };
    expect(i.radius).toBeGreaterThan(0);
    expect(i.bonus).toBeGreaterThan(0);
  },
  'holy-aura': (a) => {
    const h = a as { radius: number; healPerTick: number };
    expect(h.radius).toBeGreaterThan(0);
    expect(h.healPerTick).toBeGreaterThan(0);
  },
  'life-drain': (a) => {
    const l = a as { fraction: number };
    expect(l.fraction).toBeGreaterThan(0);
    expect(l.fraction).toBeLessThanOrEqual(1);
  },
  'breath-weapon': (a) => {
    const b = a as { damage: number; range: number; cooldown: number };
    expect(b.damage).toBeGreaterThan(0);
    expect(b.range).toBeGreaterThan(0);
    expect(b.cooldown).toBeGreaterThan(0);
  },
  trample: () => {},
  undead: () => {},
  fearless: () => {},
  'pack-hunter': () => {},
};

const creatures = Object.values(CREATURE_UNITS);
const summons = creatures.filter((u) => u.role === 'summon');
const monsters = creatures.filter((u) => u.role === 'monster');

describe('CREATURE_UNITS shape', () => {
  it('keys CREATURE_UNITS by each unit\'s own id, all kebab-case', () => {
    for (const [key, unit] of Object.entries(CREATURE_UNITS)) {
      expect(unit.id).toBe(key);
      expect(unit.id).toMatch(KEBAB_CASE);
    }
  });

  it('gives every creature a non-empty description', () => {
    for (const unit of creatures) {
      expect(unit.description.length, unit.id).toBeGreaterThan(0);
    }
  });

  it('validates every ability against the typed vocabulary', () => {
    for (const unit of creatures) {
      for (const ability of unit.abilities) {
        const validator = ABILITY_VALIDATORS[ability.type];
        expect(validator, `${unit.id} uses unknown ability type ${ability.type}`).toBeDefined();
        validator(ability);
      }
    }
  });

  it('splits creatures into only summon and monster roles', () => {
    expect(summons.length + monsters.length).toBe(creatures.length);
  });
});

describe('school summons', () => {
  it('includes skeleton (death) and angel (life) with their exact ids', () => {
    expect(CREATURE_UNITS.skeleton).toBeDefined();
    expect(CREATURE_UNITS.skeleton?.origin).toEqual({ school: 'death' });
    expect(CREATURE_UNITS.angel).toBeDefined();
    expect(CREATURE_UNITS.angel?.origin).toEqual({ school: 'life' });
  });

  it('gives every summon an origin school and a positive summonCost', () => {
    for (const unit of summons) {
      expect(unit.origin).toHaveProperty('school');
      const school = (unit.origin as { school: SchoolId }).school;
      expect(SCHOOL_IDS).toContain(school);
      expect(unit.summonCost, unit.id).toBeGreaterThan(0);
      expect(unit.cost, unit.id).toBeUndefined();
    }
  });

  it('gives each of the 5 schools exactly 3 summons', () => {
    const bySchool = new Map<SchoolId, UnitDef[]>();
    for (const unit of summons) {
      const school = (unit.origin as { school: SchoolId }).school;
      if (!bySchool.has(school)) bySchool.set(school, []);
      bySchool.get(school)?.push(unit);
    }
    expect(bySchool.size).toBe(5);
    for (const school of SCHOOL_IDS) {
      expect(bySchool.get(school)?.length, school).toBe(3);
    }
  });

  it('orders mean summonCost: death < {chaos,nature,sorcery} < life', () => {
    const mean = (school: SchoolId) => {
      const group = summons.filter((u) => (u.origin as { school: SchoolId }).school === school);
      return group.reduce((sum, u) => sum + (u.summonCost ?? 0), 0) / group.length;
    };
    const deathMean = mean('death');
    const lifeMean = mean('life');
    const chaosMean = mean('chaos');
    const natureMean = mean('nature');
    const sorceryMean = mean('sorcery');

    for (const midMean of [chaosMean, natureMean, sorceryMean]) {
      expect(deathMean).toBeLessThan(midMean);
      expect(midMean).toBeLessThan(lifeMean);
    }
  });

  it('makes angel cost at least 10x skeleton to summon', () => {
    const skeleton = CREATURE_UNITS.skeleton;
    const angel = CREATURE_UNITS.angel;
    expect(skeleton?.summonCost).toBeDefined();
    expect(angel?.summonCost).toBeDefined();
    expect(angel?.summonCost ?? 0).toBeGreaterThanOrEqual((skeleton?.summonCost ?? 0) * 10);
  });
});

describe('lair monsters', () => {
  it('has 6-8 neutral monsters, generic origin, no cost or summonCost', () => {
    expect(monsters.length).toBeGreaterThanOrEqual(6);
    expect(monsters.length).toBeLessThanOrEqual(8);
    for (const unit of monsters) {
      expect(unit.origin).toEqual({ generic: true });
      expect(unit.cost, unit.id).toBeUndefined();
      expect(unit.summonCost, unit.id).toBeUndefined();
    }
  });

  it('has at least one monster (the elder dragon) with breath-weapon and fear', () => {
    const found = monsters.some((unit) => {
      const types = unit.abilities.map((a) => a.type);
      return types.includes('breath-weapon') && types.includes('fear');
    });
    expect(found).toBe(true);
  });
});
