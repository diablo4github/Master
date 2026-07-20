import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import {
  SPEARMEN,
  SWORDSMEN,
  ARCHERS,
  CAVALRY,
  MILITIA,
  PIKES,
  HEAVY_INFANTRY,
  unit,
} from './testkit';
import type { UnitDef } from '../types';
import type { BattleSide } from './events';

/**
 * A full stack-cap battle: 9 regiments a side, ~2,900 figures each, mixed arms.
 * The frontage model + batched binomial rolls must keep this cheap enough for
 * the viewer to replay: a decisive resolution in well under two seconds and an
 * event log a browser can hold comfortably (< 20k events).
 */
function nineUnitSide(prefix: string): BattleSide {
  const roster: UnitDef[] = [
    SPEARMEN, SWORDSMEN, ARCHERS, CAVALRY, MILITIA, PIKES, HEAVY_INFANTRY, SPEARMEN, ARCHERS,
  ];
  return { units: roster.map((def, i) => unit(`${prefix}-${i}`, def)) };
}

describe('performance: a 9v9 regiment battle stays viewer-cheap', () => {
  it('resolves in under 2s with fewer than 20k events, across several seeds', () => {
    const seeds = [1, 2, 3, 4, 5];
    let worstMs = 0;
    let worstEvents = 0;
    let worstTicks = 0;
    for (const seed of seeds) {
      const t0 = performance.now();
      const r = runBattle({
        seed,
        attacker: nineUnitSide('a'),
        defender: nineUnitSide('d'),
        terrain: { plane: 'meridia', terrain: 'forest' },
      });
      const ms = performance.now() - t0;
      worstMs = Math.max(worstMs, ms);
      worstEvents = Math.max(worstEvents, r.events.length);
      worstTicks = Math.max(worstTicks, r.outcome.ticks);
    }
    // Surfaced on failure so a regression reads as numbers, not a bare boolean.
    expect({ worstMs: Math.round(worstMs), worstEvents, worstTicks }).toBeTruthy();
    expect(worstMs).toBeLessThan(2000);
    expect(worstEvents).toBeLessThan(20000);
  });
});
