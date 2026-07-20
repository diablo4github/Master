import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { CAVALRY, MILITIA, SPEARMEN, ARCHERS, mkUnit, sideOf, unit } from './testkit';
import type { BattleInput } from './events';

const MIXED: BattleInput = {
  seed: 777,
  attacker: { units: [unit('cav', CAVALRY), unit('spear', SPEARMEN), unit('bow', ARCHERS)] },
  defender: { units: [unit('m0', MILITIA), unit('m1', MILITIA), unit('m2', MILITIA)] },
  terrain: { plane: 'meridia', terrain: 'forest' },
};

/** Two immortal undead tanks that out-regenerate each other — never resolves. */
const IMMORTAL = mkUnit('lich-golem', {
  skill: 40,
  abilities: [{ type: 'undead' }, { type: 'regeneration', perTick: 40 }],
  combat: { figures: 2, hits: 20, melee: { attack: 4, damage: 2, reach: 1 }, armor: 6, speed: 2, mass: 4, morale: 0, discipline: 0 },
});

describe('determinism & serialization', () => {
  it('identical input yields a deep-equal BattleReport', () => {
    const a = runBattle(MIXED);
    const b = runBattle(MIXED);
    expect(a).toEqual(b);
  });

  it('the report round-trips through JSON unchanged', () => {
    const a = runBattle(MIXED);
    const round = JSON.parse(JSON.stringify(a));
    expect(round).toEqual(a);
  });

  it('every event and the whole outcome are JSON-serializable (no undefined/functions)', () => {
    const a = runBattle(MIXED);
    const json = JSON.stringify(a);
    expect(typeof json).toBe('string');
    // Round-trip equality already proves no Map/Set/functions leaked in.
    expect(JSON.parse(json)).toEqual(a);
  });

  it('a battle that cannot resolve hits the tick cap and ends in a draw', () => {
    const r = runBattle({
      seed: 12,
      attacker: sideOf(IMMORTAL, 1, 'a'),
      defender: sideOf(IMMORTAL, 1, 'd'),
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    expect(r.outcome.ticks).toBe(400);
    expect(r.outcome.winner).toBe('draw');
    const end = r.events[r.events.length - 1]!;
    expect(end.type).toBe('battle-end');
  });

  it('battle-start carries the schema version, field, and a summary per unit', () => {
    const r = runBattle(MIXED);
    const start = r.events[0]!;
    expect(start.type).toBe('battle-start');
    if (start.type === 'battle-start') {
      expect(start.schemaVersion).toBe(1);
      expect(start.units).toHaveLength(6);
      expect(start.field.width).toBe(20);
      expect(start.field.height).toBe(14);
    }
  });
});
