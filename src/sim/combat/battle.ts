/**
 * Public entry point for the auto-resolved tactical combat engine.
 *
 *   runBattle(input): BattleReport
 *
 * Determinism: the whole battle is driven by a single seeded Rng
 * (createRng(input.seed)); identical input yields a byte-for-byte identical,
 * JSON-serializable BattleReport. The report's `events` array is a complete,
 * self-describing replay (see events.ts) — the viewer animates it without ever
 * re-running the simulation.
 *
 * Contract notes:
 *  - Up to 9 units per side (BattleSide.units); more are accepted but the design
 *    cap is 9.
 *  - Each input unit carries its current hp pool (max = figures × hits); the
 *    engine derives surviving figures from it and maps casualties back out.
 */

import { createRng } from '../core/rng';
import {
  type Combatant,
  type BattleContext,
  type Side,
  totalHp,
  occKey,
} from './internal';
import { generateBattlefield, deploy } from './battlefield';
import { runEngine } from './engine';
import type {
  BattleInput,
  BattleReport,
  BattleUnitInput,
  BattleEvent,
  UnitSummary,
  BattleEndSurvivor,
  BattleWinner,
} from './events';
import { BATTLE_EVENT_SCHEMA_VERSION } from './events';

function makeCombatant(u: BattleUnitInput, side: Side): Combatant | null {
  const cs = u.def.combat;
  const maxHits = cs.hits;
  const maxFigures = cs.figures;
  const cap = maxFigures * maxHits;
  const hp = Math.max(0, Math.min(cap, Math.round(u.hp)));
  if (hp <= 0) return null; // already dead — not deployed
  const figures = Math.min(maxFigures, Math.ceil(hp / maxHits));
  const topHp = hp - (figures - 1) * maxHits;
  return {
    id: u.id,
    side,
    def: u.def,
    x: 0,
    y: 0,
    figures,
    topHp: topHp > 0 ? topHp : maxHits,
    maxHits,
    maxFigures,
    ammo: cs.ranged ? cs.ranged.ammo : 0,
    morale: cs.morale,
    status: 'fighting',
    facing: -1,
    poison: 0,
    breathCooldown: 0,
    lastFearTick: -100,
    movedThisActivation: 0,
    engagedLast: [],
    brokenOnce: false,
    figuresAtTickStart: figures,
    lostThisTick: 0,
    worstCasualtyTrigger: null,
    routedTick: -1,
  };
}

function summarize(c: Combatant): UnitSummary {
  const cs = c.def.combat;
  return {
    id: c.id,
    side: c.side,
    name: c.def.name,
    defId: c.def.id,
    role: c.def.role,
    figures: c.figures,
    hits: c.maxHits,
    maxHp: c.maxFigures * c.maxHits,
    startHp: totalHp(c),
    skill: c.def.skill,
    speed: cs.speed,
    armor: cs.armor,
    mass: cs.mass,
    reach: cs.melee.reach,
    morale: cs.morale,
    discipline: cs.discipline,
    hasRanged: cs.ranged !== undefined,
    range: cs.ranged ? cs.ranged.range : 0,
    ammo: c.ammo,
    abilities: c.def.abilities,
    start: { x: c.x, y: c.y },
  };
}

function survivorsOf(ctx: BattleContext, side: Side): BattleEndSurvivor[] {
  return ctx.combatants
    .filter((c) => c.side === side && c.figures > 0)
    .map((c) => ({ id: c.id, hp: totalHp(c) }));
}

/** Runs a full battle and returns a deterministic, serializable report. */
export function runBattle(input: BattleInput): BattleReport {
  const rng = createRng(input.seed);
  const field = generateBattlefield(input.terrain.plane, input.terrain.terrain, rng);

  const combatants: Combatant[] = [];
  for (const u of input.attacker.units) {
    const c = makeCombatant(u, 'attacker');
    if (c) combatants.push(c);
  }
  for (const u of input.defender.units) {
    const c = makeCombatant(u, 'defender');
    if (c) combatants.push(c);
  }

  deploy(field, combatants, rng);

  const events: BattleEvent[] = [];
  const occ = new Map<string, string>();
  for (const c of combatants) occ.set(occKey(c.x, c.y), c.id);

  // battle-start: everything a viewer needs to draw the opening frame.
  events.push({
    type: 'battle-start',
    tick: 0,
    schemaVersion: BATTLE_EVENT_SCHEMA_VERSION,
    field: {
      plane: field.plane,
      terrain: field.terrain,
      width: field.width,
      height: field.height,
      blocked: field.blocked.map((p) => ({ x: p.x, y: p.y })),
      cover: field.cover.map((p) => ({ x: p.x, y: p.y })),
    },
    units: combatants.map(summarize),
  });

  const ctx: BattleContext = { rng, field, combatants, events, tick: 0, occ };
  const ticks = runEngine(ctx);

  const attackerAlive = ctx.combatants.filter((c) => c.side === 'attacker' && c.figures > 0 && c.status !== 'fled');
  const defenderAlive = ctx.combatants.filter((c) => c.side === 'defender' && c.figures > 0 && c.status !== 'fled');
  let winner: BattleWinner;
  if (attackerAlive.length > 0 && defenderAlive.length === 0) winner = 'attacker';
  else if (defenderAlive.length > 0 && attackerAlive.length === 0) winner = 'defender';
  else winner = 'draw';

  const survivors = {
    attacker: survivorsOf(ctx, 'attacker'),
    defender: survivorsOf(ctx, 'defender'),
  };

  events.push({ type: 'battle-end', tick: ticks, winner, survivors });

  return { events, outcome: { winner, survivors, ticks } };
}
