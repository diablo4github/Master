import { describe, expect, it } from 'vitest';
import { resolveStacks, type StackUnit } from './resolve';
import { CAVALRY, MILITIA } from './testkit';
import type { UnitState, UnitDef } from '../types';

function stackUnit(id: string, def: UnitDef, hp?: number): StackUnit {
  const full = def.combat.figures * def.combat.hits;
  const state: UnitState = {
    id,
    owner: 'player-0',
    defId: def.id,
    plane: 'meridia',
    x: 5,
    y: 5,
    moves: def.moves,
    hp: hp ?? full,
  };
  return { state, def };
}

describe('resolveStacks maps casualties back to strategic units', () => {
  it('removes the dead (survived=false, hp=0) and reduces survivors, without mutating inputs', () => {
    const attacker = [stackUnit('a-cav-0', CAVALRY), stackUnit('a-cav-1', CAVALRY)];
    const defender = [stackUnit('d-mil-0', MILITIA)];
    const originalDefHp = defender[0]!.state.hp;

    const res = resolveStacks({
      seed: 1,
      attacker,
      defender,
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });

    // Cavalry crush a lone militia unit.
    expect(res.winner).toBe('attacker');
    expect(res.defender).toHaveLength(1);
    expect(res.defender[0]).toEqual({ id: 'd-mil-0', survived: false, hp: 0 });

    // Attacker outcomes map one-to-one and never exceed the starting pool.
    expect(res.attacker.map((o) => o.id)).toEqual(['a-cav-0', 'a-cav-1']);
    for (const o of res.attacker) {
      expect(o.hp).toBeLessThanOrEqual(CAVALRY.combat.figures * CAVALRY.combat.hits);
      expect(o.hp).toBeGreaterThanOrEqual(0);
      expect(o.survived).toBe(o.hp > 0);
    }

    // Purity: the input UnitStates are untouched.
    expect(defender[0]!.state.hp).toBe(originalDefHp);
    expect(attacker[0]!.state.hp).toBe(CAVALRY.combat.figures * CAVALRY.combat.hits);
  });

  it('is deterministic and carries the full replay report', () => {
    const build = (): { attacker: StackUnit[]; defender: StackUnit[] } => ({
      attacker: [stackUnit('a0', CAVALRY), stackUnit('a1', MILITIA)],
      defender: [stackUnit('d0', MILITIA), stackUnit('d1', MILITIA)],
    });
    const input = { seed: 99, terrain: { plane: 'meridia' as const, terrain: 'grassland' as const } };
    const a = resolveStacks({ ...input, ...build() });
    const b = resolveStacks({ ...input, ...build() });
    expect(a.attacker).toEqual(b.attacker);
    expect(a.defender).toEqual(b.defender);
    expect(a.report.events[0]!.type).toBe('battle-start');
    expect(a.report.outcome.ticks).toBe(b.report.outcome.ticks);
  });
});
