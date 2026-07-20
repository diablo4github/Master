import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { CAVALRY, MILITIA, PIKES, sideOf } from './testkit';

describe('charge physics: mass × speed vs discipline/cohesion', () => {
  it('cavalry charging low-discipline militia routs and kills dramatically', () => {
    let attackerWins = 0;
    let scenariosWithRout = 0;
    const seeds = [1, 2, 3, 4, 5];
    for (const seed of seeds) {
      const r = runBattle({
        seed,
        attacker: sideOf(CAVALRY, 3, 'cav'),
        defender: sideOf(MILITIA, 3, 'mil'),
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      if (r.outcome.winner === 'attacker') attackerWins += 1;
      if (r.events.some((e) => e.type === 'rout' && e.unitId.startsWith('mil'))) scenariosWithRout += 1;
    }
    expect(attackerWins).toBe(seeds.length);
    expect(scenariosWithRout).toBeGreaterThanOrEqual(4);
  });

  it('the same charge into high-discipline braced pikes does NOT rout them — the anvil holds', () => {
    const seeds = [1, 2, 3, 4, 5];
    let pikesWon = 0;
    for (const seed of seeds) {
      const r = runBattle({
        seed,
        attacker: sideOf(CAVALRY, 3, 'cav'),
        defender: sideOf(PIKES, 3, 'pike'),
        terrain: { plane: 'meridia', terrain: 'grassland' },
      });
      // The anvil holds: the pikes win and ALL three units survive the charge.
      // (A lone momentary rout that rallies is fine; being shattered is not.)
      if (r.outcome.winner === 'defender' && r.outcome.survivors.defender.length === 3) pikesWon += 1;
    }
    expect(pikesWon).toBe(seeds.length);
  });

  it('a charge emits a charge-triggered morale check on the target', () => {
    const r = runBattle({
      seed: 2,
      attacker: sideOf(CAVALRY, 3, 'cav'),
      defender: sideOf(MILITIA, 3, 'mil'),
      terrain: { plane: 'meridia', terrain: 'grassland' },
    });
    expect(r.events.some((e) => e.type === 'morale-check' && e.trigger === 'charge')).toBe(true);
    expect(r.events.some((e) => e.type === 'damage' && e.kind === 'charge')).toBe(true);
  });
});
