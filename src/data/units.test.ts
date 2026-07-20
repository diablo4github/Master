import { describe, expect, it } from 'vitest';
import { UNITS } from './units';
import { RACES } from './races';

const units = Object.values(UNITS);
const raceIds = new Set(Object.keys(RACES));

const KEBAB_CASE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

describe('units', () => {
  it('has exactly 6 units', () => {
    expect(units).toHaveLength(6);
  });

  it('uses lowercase kebab-case ids that match their record key', () => {
    for (const [key, unit] of Object.entries(UNITS)) {
      expect(unit.id).toBe(key);
      expect(unit.id, unit.id).toMatch(KEBAB_CASE);
    }
  });

  it('points every race-origin unit at a race that exists in RACES', () => {
    for (const unit of units) {
      if ('race' in unit.origin) {
        expect(raceIds.has(unit.origin.race), `${unit.id} -> ${unit.origin.race}`).toBe(true);
      }
    }
  });

  it('makes settler and militia generic (any race can train them)', () => {
    expect(UNITS.settler?.origin).toEqual({ generic: true });
    expect(UNITS.militia?.origin).toEqual({ generic: true });
  });

  it('gives death cheap summons and life rare, expensive ones (angel > 10x skeleton)', () => {
    const skeleton = UNITS.skeleton;
    const angel = UNITS.angel;
    expect(skeleton).toBeDefined();
    expect(angel).toBeDefined();
    if (!skeleton || !angel) throw new Error('unreachable');

    expect(skeleton.origin).toEqual({ school: 'death' });
    expect(angel.origin).toEqual({ school: 'life' });
    expect(skeleton.summonCost).toBeDefined();
    expect(angel.summonCost).toBeDefined();
    expect(angel.summonCost as number).toBeGreaterThan((skeleton.summonCost as number) * 10);
  });

  it('gives every mundane (non-summon) unit a positive production cost', () => {
    for (const unit of units) {
      if (unit.role !== 'summon') {
        expect(unit.cost, unit.id).toBeDefined();
        expect(unit.cost as number).toBeGreaterThan(0);
      }
    }
  });

  it('makes the angel out-attack every mundane unit', () => {
    const angel = UNITS.angel;
    expect(angel).toBeDefined();
    if (!angel) throw new Error('unreachable');

    for (const unit of units) {
      if (unit.role === 'summon') continue;
      expect(angel.attack, `angel vs ${unit.id}`).toBeGreaterThan(unit.attack);
    }
  });

  it('gives every unit full combat stats and non-empty abilities/description', () => {
    for (const unit of units) {
      expect(unit.attack).toBeGreaterThanOrEqual(0);
      expect(unit.defense).toBeGreaterThanOrEqual(0);
      expect(unit.hits).toBeGreaterThan(0);
      expect(unit.moves).toBeGreaterThan(0);
      expect(unit.skill).toBeGreaterThanOrEqual(0);
      expect(unit.skill).toBeLessThanOrEqual(100);
      expect(unit.abilities.length).toBeGreaterThan(0);
      expect(unit.description.length).toBeGreaterThan(0);
    }
  });
});
