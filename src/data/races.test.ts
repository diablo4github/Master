import { describe, expect, it } from 'vitest';
import { RACES } from './races';
import { BUILDINGS } from './buildings';

const races = Object.values(RACES);
const buildingIds = new Set(Object.keys(BUILDINGS));

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('races', () => {
  it('has exactly 30 races', () => {
    expect(races).toHaveLength(30);
  });

  it('splits 18 meridia / 6 umbra / 6 lumina by homeWorld', () => {
    const byWorld = { meridia: 0, umbra: 0, lumina: 0 };
    for (const race of races) {
      byWorld[race.homeWorld]++;
    }
    expect(byWorld).toEqual({ meridia: 18, umbra: 6, lumina: 6 });
  });

  it('has exactly one generic race, and it is orcs with an all-1.0 baseline', () => {
    const generic = races.filter((r) => r.generic === true);
    expect(generic).toHaveLength(1);
    expect(generic[0]?.id).toBe('orcs');

    const orcs = RACES.orcs;
    expect(orcs).toBeDefined();
    if (!orcs) throw new Error('unreachable');
    expect(orcs.homeWorld).toBe('meridia');
    expect(orcs.growthRate).toBe(1.0);
    expect(orcs.yields).toEqual({
      food: 1.0,
      production: 1.0,
      gold: 1.0,
      research: 1.0,
      mana: 1.0,
    });
  });

  it('gives humans life affinity and the full temple chain', () => {
    const humans = RACES.humans;
    expect(humans).toBeDefined();
    if (!humans) throw new Error('unreachable');
    expect(humans.schoolAffinity).toBe('life');

    const templeChain = [
      'temple',
      'grand-tabernacle',
      'temple-of-radiant-vows',
      'gilded-temple-spire',
      'celestial-temple',
    ];
    for (const buildingId of templeChain) {
      expect(humans.buildings).toContain(buildingId);
    }
    // The top tier specifically must be present — this is the constraint
    // that most distinguishes humans from every other race.
    expect(humans.buildings).toContain('celestial-temple');
  });

  it('references only building ids that exist in BUILDINGS', () => {
    for (const race of races) {
      for (const buildingId of race.buildings) {
        expect(buildingIds.has(buildingId), `${race.id} -> ${buildingId}`).toBe(true);
      }
    }
  });

  it('has every BuildingDef.requires pointing at an existing building id', () => {
    for (const building of Object.values(BUILDINGS)) {
      if (building.requires) {
        expect(buildingIds.has(building.requires), `${building.id} requires ${building.requires}`).toBe(
          true,
        );
      }
    }
  });

  it('uses lowercase kebab-case ids for races and buildings', () => {
    for (const race of races) {
      expect(race.id, race.id).toMatch(KEBAB_CASE);
    }
    for (const buildingId of buildingIds) {
      expect(buildingId, buildingId).toMatch(KEBAB_CASE);
    }
  });

  it('keys RACES by each race\'s own id', () => {
    for (const [key, race] of Object.entries(RACES)) {
      expect(race.id).toBe(key);
    }
  });

  it('has no duplicate race names', () => {
    const names = races.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every race between 3 and 6 study nodes, prefixed with its own id', () => {
    for (const race of races) {
      expect(race.studies.length).toBeGreaterThanOrEqual(3);
      expect(race.studies.length).toBeLessThanOrEqual(6);
      for (const studyId of race.studies) {
        expect(studyId.startsWith(`${race.id}-`), `${race.id} -> ${studyId}`).toBe(true);
      }
    }
  });

  it('keeps growthRate in 0.5-1.5 and each yield in 0.5-2.0', () => {
    for (const race of races) {
      expect(race.growthRate).toBeGreaterThanOrEqual(0.5);
      expect(race.growthRate).toBeLessThanOrEqual(1.5);
      for (const value of Object.values(race.yields)) {
        expect(value).toBeGreaterThanOrEqual(0.5);
        expect(value).toBeLessThanOrEqual(2.0);
      }
    }
  });
});

describe('buildings', () => {
  it('has between 35 and 50 buildings spanning tiers 1-5', () => {
    const all = Object.values(BUILDINGS);
    expect(all.length).toBeGreaterThanOrEqual(35);
    expect(all.length).toBeLessThanOrEqual(50);
    const tiers = new Set(all.map((b) => b.tier));
    for (const tier of [1, 2, 3, 4, 5]) {
      expect(tiers.has(tier)).toBe(true);
    }
  });

  it('keys BUILDINGS by each building\'s own id', () => {
    for (const [key, building] of Object.entries(BUILDINGS)) {
      expect(building.id).toBe(key);
    }
  });

  it('gives every building a non-empty structured effects object', () => {
    for (const building of Object.values(BUILDINGS)) {
      const fieldCount = Object.keys(building.effects).length;
      expect(fieldCount, `${building.id} has no effects fields`).toBeGreaterThan(0);
    }
  });
});
