/**
 * Morale & cohesion. Morale decides as many fights as damage does.
 *
 * A morale check succeeds when `roll (0..100) < threshold`, where
 *   threshold = morale
 *             + discipline × DISCIPLINE_WEIGHT   (formation training resists panic)
 *             + composure                        (skill: veterans steady, greens flinch)
 *             + inspire auras from nearby allies
 *             − penalty                          (the shock being tested)
 *
 * Composure is where SKILL touches morale — and only morale. The design brief
 * explicitly calls for green troops to "panic-check with a penalty" and veterans
 * to "rally after breaks"; skill never touches to-hit. `undead` never checks
 * (silent, never routs); `fearless` auto-passes but still emits an event so a
 * viewer can show it standing firm.
 */

import {
  type BattleContext,
  type Combatant,
  chebyshev,
  hasAbility,
  checksMorale,
  abilityOf,
  homeEdgeX,
  dirIndexTo,
  MORALE_TICK_FRACTION,
  MORALE_ATTRITION_FLOOR,
  CASUALTY_BASE,
  CASUALTY_TICK_K,
  CASUALTY_ATTRITION_K,
  ROUT_CONTAGION_RADIUS,
  ROUT_CONTAGION_PENALTY,
} from './internal';
import type { MoraleTrigger } from './events';

const DISCIPLINE_WEIGHT = 0.25;

/** Skill → composure. Veterans steady the line; green troops flinch. */
export function composure(c: Combatant): number {
  return (c.def.skill - 30) / 3;
}

function disciplineBonus(c: Combatant): number {
  return c.def.combat.discipline * DISCIPLINE_WEIGHT;
}

/** Sum of inspire-aura bonuses from living allies within range. */
export function inspireBonus(ctx: BattleContext, c: Combatant): number {
  let bonus = 0;
  for (const a of ctx.combatants) {
    if (a.side !== c.side || a.id === c.id || a.figures <= 0 || a.status === 'routing') continue;
    const insp = abilityOf(a.def, 'inspire');
    if (insp && chebyshev(a.x, a.y, c.x, c.y) <= insp.radius) bonus += insp.bonus;
  }
  return bonus;
}

function passThreshold(ctx: BattleContext, c: Combatant, penalty: number): number {
  return c.morale + disciplineBonus(c) + composure(c) + inspireBonus(ctx, c) - penalty;
}

/** Points a routing unit toward its own map edge. */
function faceHome(c: Combatant, ctx: BattleContext): void {
  const ex = homeEdgeX(c.side, ctx.field);
  c.facing = dirIndexTo(c.x, c.y, ex, c.y);
}

/** Breaks a unit: it starts routing toward its edge. */
function rout(ctx: BattleContext, c: Combatant): void {
  c.status = 'routing';
  c.brokenOnce = true;
  c.routedTick = ctx.tick;
  c.morale = Math.max(0, c.morale - 15);
  faceHome(c, ctx);
  ctx.events.push({ type: 'rout', tick: ctx.tick, unitId: c.id, at: { x: c.x, y: c.y } });
}

/**
 * Runs a morale check for `trigger` with the given shock `penalty`. Emits a
 * morale-check event (except for undead, which never check) and routs the unit
 * on failure. Returns whether it held.
 */
export function moraleCheck(
  ctx: BattleContext,
  c: Combatant,
  trigger: MoraleTrigger,
  penalty: number,
): boolean {
  if (!checksMorale(c.def)) return true; // undead: silent, unbreakable
  if (c.status !== 'fighting') return true; // already routing/dead
  const at = { x: c.x, y: c.y };

  if (hasAbility(c.def, 'fearless')) {
    ctx.events.push({
      type: 'morale-check',
      tick: ctx.tick,
      unitId: c.id,
      trigger,
      threshold: 999,
      roll: 0,
      passed: true,
      at,
    });
    return true;
  }

  const threshold = passThreshold(ctx, c, penalty);
  const roll = ctx.rng.next() * 100;
  const passed = roll < threshold;
  ctx.events.push({
    type: 'morale-check',
    tick: ctx.tick,
    unitId: c.id,
    trigger,
    threshold: Math.round(threshold * 10) / 10,
    roll: Math.round(roll * 10) / 10,
    passed,
    at,
  });
  if (!passed) rout(ctx, c);
  return passed;
}

/**
 * A routing unit tries to rally back into the fight. Odds rise with discipline,
 * composure (veterans rally), and inspire auras, and fall the more broken the
 * unit is. `undead`/`fearless` never route, so they never reach this path.
 */
export function tryRally(ctx: BattleContext, c: Combatant): void {
  if (c.status !== 'routing') return;
  const threshold =
    c.def.combat.discipline * 0.4 + composure(c) + inspireBonus(ctx, c) - (100 - c.morale) * 0.1;
  const roll = ctx.rng.next() * 100;
  if (roll < threshold) {
    c.status = 'fighting';
    c.morale = Math.min(c.def.combat.morale, c.morale + 20);
    ctx.events.push({ type: 'rally', tick: ctx.tick, unitId: c.id, at: { x: c.x, y: c.y } });
  }
}

/**
 * Fear auras: at end of tick, enemies within a fearsome unit's radius test
 * morale (throttled per unit so it isn't spammed every tick). Undead are immune
 * (no event); fearless auto-pass.
 */
export function applyFearAuras(ctx: BattleContext): void {
  const FEAR_THROTTLE = 4;
  const scary = ctx.combatants.filter((c) => c.figures > 0 && hasAbility(c.def, 'fear'));
  if (scary.length === 0) return;
  for (const c of ctx.combatants) {
    if (c.figures <= 0 || c.status !== 'fighting') continue;
    if (!checksMorale(c.def)) continue; // undead immune to fear — silent
    if (ctx.tick - c.lastFearTick < FEAR_THROTTLE) continue;
    let worst = 0;
    for (const s of scary) {
      if (s.side === c.side) continue;
      const fear = abilityOf(s.def, 'fear');
      if (fear && chebyshev(s.x, s.y, c.x, c.y) <= fear.radius) {
        worst = Math.max(worst, 12 + fear.radius * 2);
      }
    }
    if (worst > 0) {
      c.lastFearTick = ctx.tick;
      moraleCheck(ctx, c, 'fear', worst);
    }
  }
}

/**
 * Proportional casualty morale, once per unit at end of tick. A regiment tests
 * its nerve when a single tick was bloody (≥ MORALE_TICK_FRACTION of its
 * start-of-tick strength) or once cumulative attrition passes the floor. The
 * shock scales with the fraction lost THIS tick and with overall depletion, so
 * fresh troops shrug off a skirmish while a half-dead line breaks on far less.
 * This is what makes a breath weapon or a flanked massacre *rout* a formation
 * rather than merely whittle it — the heart of regiment-scale morale.
 */
export function applyCasualtyMorale(ctx: BattleContext): void {
  for (const c of ctx.combatants) {
    if (c.figures <= 0 || c.status !== 'fighting') continue;
    if (c.lostThisTick <= 0 || c.figuresAtTickStart <= 0) continue;
    const tickFrac = c.lostThisTick / c.figuresAtTickStart;
    const overallFrac = 1 - c.figures / c.maxFigures;
    if (tickFrac < MORALE_TICK_FRACTION && overallFrac < MORALE_ATTRITION_FLOOR) continue;
    const penalty = CASUALTY_BASE + tickFrac * CASUALTY_TICK_K + overallFrac * CASUALTY_ATTRITION_K;
    moraleCheck(ctx, c, c.worstCasualtyTrigger ?? 'casualties', penalty);
  }
}

/**
 * Rout contagion: a formation breaking is contagious. Units that routed THIS
 * tick test the nerve of every still-fighting ally within
 * ROUT_CONTAGION_RADIUS. One pass (keyed on routedTick) — a chain of breaks
 * unfolds across ticks, never in an unbounded loop within one tick.
 */
export function applyRoutContagion(ctx: BattleContext): void {
  const routed = ctx.combatants.filter((c) => c.routedTick === ctx.tick && c.status === 'routing');
  if (routed.length === 0) return;
  for (const c of ctx.combatants) {
    if (c.figures <= 0 || c.status !== 'fighting' || !checksMorale(c.def)) continue;
    for (const r of routed) {
      if (r.side !== c.side || r.id === c.id) continue;
      if (chebyshev(r.x, r.y, c.x, c.y) <= ROUT_CONTAGION_RADIUS) {
        moraleCheck(ctx, c, 'ally-rout', ROUT_CONTAGION_PENALTY);
        break;
      }
    }
  }
}
