import { describe, expect, it } from 'vitest';
import { UMBRA_UNITS, LUMINA_UNITS } from './umbra-lumina';
import { RACES } from '../races';
import type { UnitDef } from '../../sim/types';

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** '<race-singular>-' id prefix each roster's units must use. */
const UMBRA_PREFIXES: Record<string, string> = {
  wraithkin: 'wraithkin-',
  ghouls: 'ghoul-',
  hollowfolk: 'hollowfolk-',
  'shadow-goblins': 'shadow-goblin-',
  'vampire-aristocracy': 'vampire-',
  'plague-cultists': 'plague-cultist-',
};

const LUMINA_PREFIXES: Record<string, string> = {
  sunborn: 'sunborn-',
  'lammasu-folk': 'lammasu-',
  'seraphic-avians': 'seraphic-avian-',
  crystalfolk: 'crystalfolk-',
  sidhefolk: 'sidhe-',
  haloborn: 'haloborn-',
};

function checkRosterShape(
  units: Record<string, UnitDef>,
  prefixes: Record<string, string>,
  worldRaceIds: Set<string>,
) {
  const byRace = new Map<string, UnitDef[]>();
  for (const [key, unit] of Object.entries(units)) {
    expect(unit.id).toBe(key);
    expect(unit.id).toMatch(KEBAB_CASE);
    expect(unit.origin).toHaveProperty('race');
    const raceId = (unit.origin as { race: string }).race;
    expect(worldRaceIds.has(raceId), `${unit.id} -> unknown race ${raceId}`).toBe(true);
    const prefix = prefixes[raceId];
    expect(prefix, `no expected prefix configured for race ${raceId}`).toBeDefined();
    expect(unit.id.startsWith(prefix as string), `${unit.id} should start with "${prefix}"`).toBe(
      true,
    );
    if (!byRace.has(raceId)) byRace.set(raceId, []);
    byRace.get(raceId)?.push(unit);
  }
  return byRace;
}

describe('UMBRA_UNITS', () => {
  const raceIds = new Set(Object.keys(UMBRA_PREFIXES));
  const byRace = checkRosterShape(UMBRA_UNITS, UMBRA_PREFIXES, raceIds);

  it('covers all 6 umbra races with 4-5 units each', () => {
    expect(byRace.size).toBe(6);
    for (const raceId of raceIds) {
      const units = byRace.get(raceId);
      expect(units, `missing roster for ${raceId}`).toBeDefined();
      expect(units?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(units?.length ?? 0).toBeLessThanOrEqual(5);
    }
  });

  it('references race ids that exist in RACES and belong to Umbra', () => {
    for (const raceId of raceIds) {
      const race = RACES[raceId];
      expect(race, raceId).toBeDefined();
      expect(race?.homeWorld).toBe('umbra');
    }
  });
});

describe('LUMINA_UNITS', () => {
  const raceIds = new Set(Object.keys(LUMINA_PREFIXES));
  const byRace = checkRosterShape(LUMINA_UNITS, LUMINA_PREFIXES, raceIds);

  it('covers all 6 lumina races with 4-5 units each', () => {
    expect(byRace.size).toBe(6);
    for (const raceId of raceIds) {
      const units = byRace.get(raceId);
      expect(units, `missing roster for ${raceId}`).toBeDefined();
      expect(units?.length ?? 0).toBeGreaterThanOrEqual(4);
      expect(units?.length ?? 0).toBeLessThanOrEqual(5);
    }
  });

  it('references race ids that exist in RACES and belong to Lumina', () => {
    for (const raceId of raceIds) {
      const race = RACES[raceId];
      expect(race, raceId).toBeDefined();
      expect(race?.homeWorld).toBe('lumina');
    }
  });
});

describe('umbra-lumina unit stats', () => {
  const allUnits = [...Object.values(UMBRA_UNITS), ...Object.values(LUMINA_UNITS)];

  it('has no duplicate ids between UMBRA_UNITS and LUMINA_UNITS', () => {
    const ids = allUnits.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every unit a non-empty description', () => {
    for (const unit of allUnits) {
      expect(unit.description.length, unit.id).toBeGreaterThan(0);
    }
  });

  it('keeps combat stats positive and sane', () => {
    for (const unit of allUnits) {
      const c = unit.combat;
      expect(c.figures, unit.id).toBeGreaterThan(0);
      expect(c.hits, unit.id).toBeGreaterThan(0);
      expect(c.melee.attack, unit.id).toBeGreaterThan(0);
      expect(c.melee.damage, unit.id).toBeGreaterThan(0);
      expect([1, 2]).toContain(c.melee.reach);
      expect(c.armor, unit.id).toBeGreaterThanOrEqual(0);
      expect(c.speed, unit.id).toBeGreaterThan(0);
      expect(c.mass, unit.id).toBeGreaterThan(0);
      expect(c.morale, unit.id).toBeGreaterThan(0);
      expect(c.morale, unit.id).toBeLessThanOrEqual(100);
      expect(c.discipline, unit.id).toBeGreaterThan(0);
      expect(c.discipline, unit.id).toBeLessThanOrEqual(100);
      if (c.ranged) {
        expect(c.ranged.attack, unit.id).toBeGreaterThan(0);
        expect(c.ranged.damage, unit.id).toBeGreaterThan(0);
        expect(c.ranged.range, unit.id).toBeGreaterThan(0);
        expect(c.ranged.ammo, unit.id).toBeGreaterThan(0);
      }
      expect(unit.moves, unit.id).toBeGreaterThan(0);
      expect(unit.skill, unit.id).toBeGreaterThan(0);
      expect(unit.cost, unit.id).toBeGreaterThan(0);
    }
  });

  it('gives race units at most one ability each', () => {
    for (const unit of allUnits) {
      expect(unit.abilities.length, unit.id).toBeLessThanOrEqual(1);
    }
  });

  it('has no summonCost on mundane race units', () => {
    for (const unit of allUnits) {
      expect(unit.summonCost, unit.id).toBeUndefined();
    }
  });

  it('makes umbra units cheaper on average than lumina units', () => {
    const mean = (units: UnitDef[]) =>
      units.reduce((sum, u) => sum + (u.cost ?? 0), 0) / units.length;
    const umbraMean = mean(Object.values(UMBRA_UNITS));
    const luminaMean = mean(Object.values(LUMINA_UNITS));
    expect(umbraMean).toBeLessThan(luminaMean);
  });
});
