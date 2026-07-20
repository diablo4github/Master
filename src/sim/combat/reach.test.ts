import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { CAVALRY, SPEARMEN, SWORDSMEN, sideOf } from './testkit';
import type { BattleReport } from './events';

/** Figures the defender loses in the single tick of first melee/charge contact. */
function firstContactLoss(report: BattleReport): number {
  const hits = report.events.filter(
    (e) => e.type === 'damage' && e.targetId.startsWith('def') && ['charge', 'melee', 'opportunity'].includes(e.kind),
  );
  if (hits.length === 0) return 0;
  const contactTick = hits[0]!.tick;
  return hits
    .filter((e) => e.type === 'damage' && e.tick === contactTick)
    .reduce((s, e) => s + (e as { figuresLost: number }).figuresLost, 0);
}

describe('reach: spears blunt a charge where swords do not', () => {
  const seeds = [42, 7, 100, 3, 55, 88];

  it('a reach-2 spear line loses far fewer figures on first contact than a reach-1 sword line, vs the same cavalry charge', () => {
    let spearTotal = 0;
    let swordTotal = 0;
    for (const seed of seeds) {
      const spear = runBattle({
        seed,
        attacker: sideOf(CAVALRY, 3, 'cav'),
        defender: sideOf(SPEARMEN, 3, 'def'),
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      const sword = runBattle({
        seed,
        attacker: sideOf(CAVALRY, 3, 'cav'),
        defender: sideOf(SWORDSMEN, 3, 'def'),
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      spearTotal += firstContactLoss(spear);
      swordTotal += firstContactLoss(sword);
    }
    // The counter is emergent (opportunity strike + impaled momentum), not a tag.
    expect(spearTotal).toBeLessThan(swordTotal);
    expect(spearTotal * 2).toBeLessThan(swordTotal); // "meaningfully" fewer
  });

  it('emits opportunity-strike (firstStrike) melee events from the spears against the cavalry', () => {
    const report = runBattle({
      seed: 100,
      attacker: sideOf(CAVALRY, 3, 'cav'),
      defender: sideOf(SPEARMEN, 3, 'def'),
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    const firstStrikes = report.events.filter(
      (e) => e.type === 'melee' && e.firstStrike && e.unitId.startsWith('def') && e.targetId.startsWith('cav'),
    );
    expect(firstStrikes.length).toBeGreaterThan(0);
  });
});
