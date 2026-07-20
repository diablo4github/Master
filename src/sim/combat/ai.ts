/**
 * Per-unit tactical AI. SKILL is the dial: it changes what a unit DECIDES to do,
 * never its raw numbers. The behavioural ladder (design brief):
 *
 *   Low skill  — blob toward the nearest enemy, loose off arrows at any range,
 *                break formation to chase, stand and die when cornered.
 *   High skill — hold effective range, kite when faster, screen and conserve,
 *                focus wounded targets (concentrating a side's output to remove
 *                whole enemy units faster), advance as a body.
 *
 * These choices are what make veterans beat identical greens: focus fire thins
 * the enemy sooner, kiting denies the slow their swing, and composure (in
 * morale.ts) keeps the line from shattering.
 */

import {
  type BattleContext,
  type Combatant,
  chebyshev,
  hasAbility,
  abilityOf,
  totalHp,
  livingEnemies,
  livingAllies,
  homeEdgeX,
  DIRS,
  inField,
  isBlocked,
  combatantAt,
} from './internal';
import {
  moveToward,
  meleeAttack,
  rangedVolley,
  opportunityStrikes,
  chargeShock,
  bestAdjacentTile,
  adjacentEnemies,
  isAdjacent,
  lineOfFire,
} from './engine';
import { canMeleeReach, fireBreath } from './abilities';

/** Skill at or above this lets a faster ranged unit kite instead of trading. */
const KITE_SKILL = 40;
/** Skill at or above this makes a unit hold effective range and focus-fire. */
const VETERAN_SKILL = 45;

function nearest(ctx: BattleContext, c: Combatant, pool: Combatant[]): Combatant | null {
  let best: Combatant | null = null;
  let bestD = Infinity;
  for (const e of pool) {
    const d = chebyshev(c.x, c.y, e.x, e.y);
    if (d < bestD || (d === bestD && best && e.id < best.id)) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function canCharge(c: Combatant): boolean {
  return hasAbility(c.def, 'charge') || (c.def.combat.mass >= 3 && c.def.combat.speed >= 3);
}

/**
 * Melee target choice. Green units pick the nearest body. Veterans score
 * targets to concentrate force: heavily weight wounded enemies and enemies
 * allies are already pressing (focus fire), lightly weight proximity.
 */
function chooseMeleeTarget(ctx: BattleContext, c: Combatant, enemies: Combatant[]): Combatant | null {
  const reachable = enemies.filter((e) => canMeleeReach(c, e));
  const pool = reachable.length > 0 ? reachable : enemies;
  if (pool.length === 0) return null;
  if (c.def.skill < VETERAN_SKILL) return nearest(ctx, c, pool);

  const allies = livingAllies(ctx, c);
  let best: Combatant | null = null;
  let bestScore = -Infinity;
  for (const e of pool) {
    const woundedness = 1 - totalHp(e) / (e.maxFigures * e.maxHits);
    const dist = chebyshev(c.x, c.y, e.x, e.y);
    let allyPressure = 0;
    for (const a of allies) if (chebyshev(a.x, a.y, e.x, e.y) <= 1) allyPressure += 1;
    // Wounded first, converge with allies, then proximity. Deterministic tiebreak.
    const score = woundedness * 4 + allyPressure * 2 - dist * 0.6;
    if (score > bestScore || (score === bestScore && best && e.id < best.id)) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Ranged target choice mirrors melee focus, plus a line-of-fire requirement. */
function chooseRangedTarget(ctx: BattleContext, c: Combatant, enemies: Combatant[], range: number): Combatant | null {
  const r = c.def.combat.ranged;
  if (!r) return null;
  const inRange = enemies.filter(
    (e) => chebyshev(c.x, c.y, e.x, e.y) <= range && lineOfFire(ctx, c.x, c.y, e.x, e.y),
  );
  if (inRange.length === 0) return null;
  if (c.def.skill < VETERAN_SKILL) return nearest(ctx, c, inRange);
  let best: Combatant | null = null;
  let bestScore = -Infinity;
  for (const e of inRange) {
    const woundedness = 1 - totalHp(e) / (e.maxFigures * e.maxHits);
    const dist = chebyshev(c.x, c.y, e.x, e.y);
    const score = woundedness * 4 - dist * 0.3;
    if (score > bestScore || (score === bestScore && best && e.id < best.id)) {
      bestScore = score;
      best = e;
    }
  }
  return best;
}

/** Step directly away from a threat, toward the home edge, staying in-field. */
function kiteAway(ctx: BattleContext, c: Combatant, threat: Combatant): void {
  const ex = homeEdgeX(c.side, ctx.field);
  // Prefer a tile that increases distance to the threat and edges homeward.
  let bestDir = -1;
  let bestScore = -Infinity;
  for (let d = 0; d < DIRS.length; d++) {
    const [dx, dy] = DIRS[d] as [number, number];
    const nx = c.x + dx;
    const ny = c.y + dy;
    if (!inField(ctx.field, nx, ny) || isBlocked(ctx.field, nx, ny) || combatantAt(ctx, nx, ny)) continue;
    const away = chebyshev(nx, ny, threat.x, threat.y);
    const homeward = -Math.abs(nx - ex);
    const score = away * 2 + homeward;
    if (score > bestScore) {
      bestScore = score;
      bestDir = d;
    }
  }
  if (bestDir >= 0) {
    const [dx, dy] = DIRS[bestDir] as [number, number];
    moveToward(ctx, c, c.x + dx, c.y + dy, c.def.combat.speed, 'kite');
  }
}

/** Approach a melee target and strike; a real charge triggers spears + shock. */
function approachAndStrike(ctx: BattleContext, c: Combatant, target: Combatant): void {
  const preAdjacent = adjacentEnemies(ctx, c).map((e) => e.id);
  let moved = 0;
  if (!isAdjacent(c, target)) {
    const dest = bestAdjacentTile(ctx, c, target);
    if (dest) {
      const charging = canCharge(c) && chebyshev(c.x, c.y, dest.x, dest.y) >= 2;
      moved = moveToward(ctx, c, dest.x, dest.y, c.def.combat.speed, charging ? 'charge' : 'advance');
    }
  }
  if (!isAdjacent(c, target) || c.figures <= 0) return;

  const charging = canCharge(c) && moved >= 2;
  // Spears / first-strikers hit the incoming unit before it lands its blow.
  opportunityStrikes(ctx, c, preAdjacent);
  if (c.figures <= 0 || c.status !== 'fighting') return;
  if (target.figures <= 0) {
    // Its target died to opportunity fire — swing at whoever else is adjacent.
    const other = adjacentEnemies(ctx, c).find((e) => canMeleeReach(c, e));
    if (!other) return;
    meleeAttack(ctx, c, other, { charging });
    return;
  }

  if (charging) chargeShock(ctx, c, target);
  meleeAttack(ctx, c, target, { charging });

  // trample: a charge that destroys its target rolls on into the next enemy.
  if (charging && hasAbility(c.def, 'trample') && target.figures <= 0) {
    const next = adjacentEnemies(ctx, c).find((e) => canMeleeReach(c, e));
    if (next) meleeAttack(ctx, c, next, { charging: true, kind: 'charge' });
  }
}

/**
 * One unit's action for this tick. Called only for units that are alive and
 * still fighting (routing units flee in the engine loop).
 */
export function takeTurn(ctx: BattleContext, c: Combatant): void {
  const enemies = livingEnemies(ctx, c);
  if (enemies.length === 0) return;

  // 1. Breath weapon — a battle-warping line blast, taken whenever it will hit.
  if (abilityOf(c.def, 'breath-weapon') && c.breathCooldown <= 0) {
    const target = chooseBreathTarget(ctx, c, enemies);
    if (target && fireBreath(ctx, c, target.x, target.y)) return;
  }

  const r = c.def.combat.ranged;
  const engaged = adjacentEnemies(ctx, c).length > 0;

  // 2. Ranged behaviour (only when not tied up in melee).
  if (r && c.ammo > 0 && !engaged) {
    const near = nearest(ctx, c, enemies);
    if (near) {
      const dist = chebyshev(c.x, c.y, near.x, near.y);
      const faster = c.def.combat.speed > near.def.combat.speed;
      const veteran = c.def.skill >= VETERAN_SKILL;
      const effective = veteran ? Math.max(2, Math.floor(r.range * 0.7)) : r.range;

      if (dist <= r.range) {
        // A faster, skilled shooter kites the moment the enemy gets close.
        if (faster && c.def.skill >= KITE_SKILL && dist <= Math.max(2, Math.floor(r.range / 2))) {
          kiteAway(ctx, c, near);
          const t = chooseRangedTarget(ctx, c, enemies, r.range);
          if (t) rangedVolley(ctx, c, t);
          return;
        }
        // Green troops loose at any range; veterans hold until effective range.
        if (dist <= effective || !veteran) {
          const t = chooseRangedTarget(ctx, c, enemies, r.range);
          if (t) {
            rangedVolley(ctx, c, t);
            return;
          }
        }
        // In range but holding fire (veteran discipline) — reposition slightly.
        if (faster) {
          kiteAway(ctx, c, near);
          return;
        }
      } else {
        // Out of range: close the distance to shoot.
        moveToward(ctx, c, near.x, near.y, c.def.combat.speed, 'advance');
        const t = chooseRangedTarget(ctx, c, enemies, r.range);
        if (t) rangedVolley(ctx, c, t);
        return;
      }
    }
  }

  // If cornered in melee with ammo left, a bow is useless — fall through to
  // fight. Ranged units are weak in melee, which is exactly why kiting matters.

  // 3. Melee.
  const target = chooseMeleeTarget(ctx, c, enemies);
  if (!target) return;
  if (isAdjacent(c, target)) {
    if (canMeleeReach(c, target)) meleeAttack(ctx, c, target, {});
    else {
      // Adjacent but can't reach (a flyer): reposition toward a reachable foe.
      const reach = enemies.find((e) => canMeleeReach(c, e));
      if (reach) approachAndStrike(ctx, c, reach);
    }
  } else {
    approachAndStrike(ctx, c, target);
  }
}

/** Pick the enemy whose line from the source sweeps the most foes. */
function chooseBreathTarget(ctx: BattleContext, c: Combatant, enemies: Combatant[]): Combatant | null {
  const breath = abilityOf(c.def, 'breath-weapon');
  if (!breath) return null;
  const inRange = enemies.filter((e) => chebyshev(c.x, c.y, e.x, e.y) <= breath.range);
  return nearest(ctx, c, inRange);
}
