/**
 * The tick loop and combat primitives (movement, melee, ranged, charge).
 *
 * COMBAT MATH (all owned here; no rock-paper-scissors, no bonus-vs-tag):
 *
 *   To-hit   pHit = clamp(HIT_BASE + HIT_K·(attackVal − evasion), FLOOR, CEIL)
 *            attackVal = melee/ranged attack + flank/rear + pack-hunter bonus
 *            evasion   = discipline·0.06 + flank/rear/routing modifiers
 *            (SKILL never enters to-hit — it only steers the AI and composure)
 *   Damage   per landed blow = max(1, damage + chargeBonus − armor)
 *            armor is flat soak; the min of 1 guarantees attrition converges.
 *   Figures  every living figure of the attacker rolls to hit; a unit at half
 *            strength lands roughly half as many blows — output scales with the
 *            formation, exactly as the design demands.
 *
 * REACH / CHARGE (emergent counters):
 *   When a unit moves into fresh contact, every adjacent enemy with strictly
 *   higher reach-priority (reach + first-strike) gets a free OPPORTUNITY STRIKE
 *   first — this is the spear line hitting the charger before impact. A charge
 *   (moved ≥ CHARGE_MIN_TILES by a mass≥3/charge unit) then adds impact damage
 *   AND a morale shock scaled by mass×speed and the charge bonus; a reach-2
 *   defender BRACES, halving that shock. So spears blunt cavalry and cavalry
 *   shatters loose infantry — from physics, never from a tag.
 *
 * INITIATIVE: each tick, living units act fastest-first (speed desc), ties by
 * side then id — fully deterministic.
 */

import {
  type BattleContext,
  type Combatant,
  type Point,
  DIRS,
  chebyshev,
  dirIndexTo,
  dirDiff,
  hasAbility,
  abilityOf,
  reachPriority,
  applyDamage,
  totalHp,
  occKey,
  combatantAt,
  isBlocked,
  isCover,
  inField,
  homeEdgeX,
  engagedFigures,
  sampleBinomial,
  recordCasualties,
  HIT_BASE,
  HIT_K,
  HIT_FLOOR,
  HIT_CEIL,
  EVASION_PER_DISCIPLINE,
  EVASION_FLANK,
  EVASION_REAR,
  EVASION_ROUTING,
  ATTACK_FLANK_BONUS,
  ATTACK_REAR_BONUS,
  PACK_HUNTER_BONUS,
  FLANK_EXTRA_FACE,
  REAR_EXTRA_FACE,
  PACK_EXTRA_FACE,
  CHARGE_MORALE_PENALTY_K,
  CHARGE_MOMENTUM_K,
  IMPALE_K,
  MAX_TICKS,
} from './internal';
import type { MoveReason, DamageKind } from './events';
import { moraleCheck, tryRally, applyFearAuras, applyCasualtyMorale, applyRoutContagion } from './morale';
import {
  canMeleeReach,
  applyLifeDrain,
  applyPoisonOnHit,
  packHunterFlank,
  endOfTickEffects,
} from './abilities';
import { takeTurn } from './ai';

// ---------------------------------------------------------------------------
// Geometry / adjacency helpers
// ---------------------------------------------------------------------------

export function isAdjacent(a: Combatant, b: Combatant): boolean {
  return chebyshev(a.x, a.y, b.x, b.y) === 1;
}

export function adjacentEnemies(ctx: BattleContext, c: Combatant): Combatant[] {
  return ctx.combatants.filter(
    (o) => o.side !== c.side && o.figures > 0 && chebyshev(o.x, o.y, c.x, c.y) === 1,
  );
}

export function inMelee(ctx: BattleContext, c: Combatant): boolean {
  return adjacentEnemies(ctx, c).some((e) => canMeleeReach(e, c) || canMeleeReach(c, e));
}

/** True if the straight line between two tiles is clear of blocking obstacles. */
export function lineOfFire(ctx: BattleContext, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
  if (steps <= 1) return true;
  for (let i = 1; i < steps; i++) {
    const x = Math.round(ax + ((bx - ax) * i) / steps);
    const y = Math.round(ay + ((by - ay) * i) / steps);
    if (isBlocked(ctx.field, x, y)) return false;
  }
  return true;
}

/** The empty, in-field, adjacent-to-target tile nearest to `c` (for approach). */
export function bestAdjacentTile(ctx: BattleContext, c: Combatant, target: Combatant): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  const flyer = hasAbility(c.def, 'flying');
  for (const [dx, dy] of DIRS) {
    const x = target.x + dx;
    const y = target.y + dy;
    if (!inField(ctx.field, x, y)) continue;
    if (!flyer && isBlocked(ctx.field, x, y)) continue;
    if (combatantAt(ctx, x, y) && !(x === c.x && y === c.y)) continue;
    const d = chebyshev(c.x, c.y, x, y);
    if (d < bestD) {
      bestD = d;
      best = { x, y };
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Movement
// ---------------------------------------------------------------------------

function setPos(ctx: BattleContext, c: Combatant, x: number, y: number): void {
  ctx.occ.delete(occKey(c.x, c.y));
  c.x = x;
  c.y = y;
  ctx.occ.set(occKey(x, y), c.id);
}

/**
 * Moves `c` up to `maxSteps` tiles greedily toward (gx,gy), avoiding blocked
 * (unless flying) and occupied tiles. Records the path, updates facing to the
 * final step direction, and emits a single move event. Returns tiles moved.
 */
export function moveToward(
  ctx: BattleContext,
  c: Combatant,
  gx: number,
  gy: number,
  maxSteps: number,
  reason: MoveReason,
): number {
  const flyer = hasAbility(c.def, 'flying');
  const from: Point = { x: c.x, y: c.y };
  const path: Point[] = [];
  let stale = 0;

  for (let step = 0; step < maxSteps; step++) {
    if (c.x === gx && c.y === gy) break;
    const curD = chebyshev(c.x, c.y, gx, gy);
    let bestDir = -1;
    let bestD = Infinity;
    for (let d = 0; d < DIRS.length; d++) {
      const [dx, dy] = DIRS[d] as [number, number];
      const nx = c.x + dx;
      const ny = c.y + dy;
      if (!inField(ctx.field, nx, ny)) continue;
      if (!flyer && isBlocked(ctx.field, nx, ny)) continue;
      if (combatantAt(ctx, nx, ny)) continue;
      const nd = chebyshev(nx, ny, gx, gy);
      if (nd < bestD) {
        bestD = nd;
        bestDir = d;
      }
    }
    if (bestDir < 0) break; // fully boxed in
    if (bestD >= curD) {
      // No strict progress: allow limited sidestepping around obstacles.
      stale += 1;
      if (bestD > curD || stale > 2) break;
    } else {
      stale = 0;
    }
    const [dx, dy] = DIRS[bestDir] as [number, number];
    setPos(ctx, c, c.x + dx, c.y + dy);
    c.facing = bestDir;
    path.push({ x: c.x, y: c.y });
  }

  if (path.length > 0) {
    ctx.events.push({
      type: 'move',
      tick: ctx.tick,
      unitId: c.id,
      from,
      to: { x: c.x, y: c.y },
      path,
      reason,
      facing: c.facing,
    });
  }
  return path.length;
}

/** Flee toward the home edge; escape (flee-off) on reaching it. */
export function flee(ctx: BattleContext, c: Combatant): void {
  const ex = homeEdgeX(c.side, ctx.field);
  moveToward(ctx, c, ex, c.y, c.def.combat.speed, 'flee');
  if (c.x === ex) {
    c.status = 'fled';
    ctx.occ.delete(occKey(c.x, c.y));
    ctx.events.push({ type: 'flee-off', tick: ctx.tick, unitId: c.id, at: { x: c.x, y: c.y } });
  }
}

// ---------------------------------------------------------------------------
// Attack resolution
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

interface FlankInfo {
  flank: boolean;
  rear: boolean;
}

/** Where is the attacker relative to the target's facing? */
function flankInfo(attacker: Combatant, target: Combatant): FlankInfo {
  if (target.facing < 0) return { flank: false, rear: false };
  const dir = dirIndexTo(target.x, target.y, attacker.x, attacker.y);
  const rel = dirDiff(dir, target.facing);
  return { flank: rel === 2 || rel === 3, rear: rel === 4 };
}

/**
 * A single melee strike: `attacker` hits `target`. Handles flank/rear, charge
 * bonus, pack-hunter, life-drain, poison, casualty morale, and death. Emits a
 * melee event, a damage event, and any ability procs.
 */
export function meleeAttack(
  ctx: BattleContext,
  attacker: Combatant,
  target: Combatant,
  opts: { charging?: boolean; kind?: DamageKind; firstStrike?: boolean; bonusDamage?: number } = {},
): void {
  if (attacker.figures <= 0 || target.figures <= 0) return;
  if (!canMeleeReach(attacker, target)) return; // can't reach a flyer

  const fi = flankInfo(attacker, target);
  const packPartner = packHunterFlank(ctx, attacker, target);

  let attackVal = attacker.def.combat.melee.attack;
  if (fi.rear) attackVal += ATTACK_REAR_BONUS;
  else if (fi.flank) attackVal += ATTACK_FLANK_BONUS;
  if (packPartner) attackVal += PACK_HUNTER_BONUS;

  const chargeAb = abilityOf(attacker.def, 'charge');
  const chargeBonus = opts.charging && chargeAb ? chargeAb.bonus : 0;

  let evasion = target.def.combat.discipline * EVASION_PER_DISCIPLINE;
  if (fi.rear) evasion += EVASION_REAR;
  else if (fi.flank) evasion += EVASION_FLANK;
  if (target.status === 'routing') evasion += EVASION_ROUTING;

  const pHit = clamp(HIT_BASE + HIT_K * (attackVal - evasion), HIT_FLOOR, HIT_CEIL);
  const perHit = Math.max(
    1,
    attacker.def.combat.melee.damage + chargeBonus + (opts.bonusDamage ?? 0) - target.def.combat.armor,
  );

  // FRONTAGE: only the fighting front swings. Flank/rear/pack widen it — the
  // extra engaged figures are a second, physical reason flanking is lethal.
  const faceWidth =
    1 +
    (fi.rear ? REAR_EXTRA_FACE : fi.flank ? FLANK_EXTRA_FACE : 0) +
    (packPartner ? PACK_EXTRA_FACE : 0);
  const engaged = engagedFigures(attacker, target, faceWidth);
  const landed = sampleBinomial(ctx.rng, engaged, pHit);
  const total = landed * perHit;

  // Attacker orients toward its target.
  attacker.facing = dirIndexTo(attacker.x, attacker.y, target.x, target.y);

  if (packPartner) {
    ctx.events.push({
      type: 'ability-proc',
      tick: ctx.tick,
      ability: 'pack-hunter',
      sourceId: attacker.id,
      targetIds: [target.id, packPartner],
      at: { x: attacker.x, y: attacker.y },
      magnitude: PACK_HUNTER_BONUS,
    });
  }

  ctx.events.push({
    type: 'melee',
    tick: ctx.tick,
    unitId: attacker.id,
    targetId: target.id,
    at: { x: target.x, y: target.y },
    // figuresAttacking is now the ENGAGED front, not the whole formation.
    figuresAttacking: engaged,
    hits: landed,
    charge: !!chargeBonus,
    flank: fi.flank,
    rear: fi.rear,
    firstStrike: !!opts.firstStrike,
  });

  const res = applyDamage(target, total);
  ctx.events.push({
    type: 'damage',
    tick: ctx.tick,
    targetId: target.id,
    sourceId: attacker.id,
    kind: opts.kind ?? (chargeBonus ? 'charge' : 'melee'),
    amount: total,
    figuresLost: res.figuresLost,
    figuresAfter: target.figures,
    hpAfter: totalHp(target),
    at: { x: target.x, y: target.y },
  });

  if (total > 0) {
    applyLifeDrain(ctx, attacker, total);
    if (landed > 0) applyPoisonOnHit(attacker, target, landed);
  }

  if (res.destroyed) {
    ctx.events.push({ type: 'death', tick: ctx.tick, unitId: target.id, at: { x: target.x, y: target.y } });
    ctx.occ.delete(occKey(target.x, target.y));
  } else if (res.figuresLost > 0) {
    // Morale is tested once, proportionally, at end of tick (see morale.ts) —
    // here we only accumulate this tick's toll and the harshest position.
    recordCasualties(target, res.figuresLost, fi.rear ? 'rear' : fi.flank ? 'flank' : 'casualties');
  }
}

/**
 * Opportunity strikes: as `mover` enters fresh contact, each newly-adjacent
 * enemy with strictly higher reach-priority strikes first (spears before the
 * charge, first-strikers before the blow). `preAdjacent` are the enemy ids the
 * mover was already touching before it moved.
 */
export function opportunityStrikes(
  ctx: BattleContext,
  mover: Combatant,
  preAdjacent: readonly string[],
  moverCharging: boolean,
): void {
  const momentum = mover.def.combat.mass * mover.def.combat.speed;
  for (const d of adjacentEnemies(ctx, mover)) {
    if (mover.figures <= 0) break;
    if (preAdjacent.includes(d.id)) continue; // not fresh contact
    if (d.status !== 'fighting') continue;
    if (reachPriority(d.def) <= reachPriority(mover.def)) continue;
    if (!canMeleeReach(d, mover)) continue;
    // A reach-2 line set to receive a charge impales the charger's momentum.
    const bonusDamage = moverCharging && d.def.combat.melee.reach >= 2 ? Math.round(momentum * IMPALE_K) : 0;
    meleeAttack(ctx, d, mover, { kind: 'opportunity', firstStrike: true, bonusDamage });
  }
}

/** The morale shock of receiving a charge; reach-2 defenders brace (halved). */
export function chargeShock(ctx: BattleContext, charger: Combatant, target: Combatant): void {
  const chargeAb = abilityOf(charger.def, 'charge');
  const bonus = chargeAb ? chargeAb.bonus : 0;
  const momentum = charger.def.combat.mass * charger.def.combat.speed;
  let penalty = bonus * CHARGE_MORALE_PENALTY_K + momentum * CHARGE_MOMENTUM_K;
  if (target.def.combat.melee.reach >= 2) penalty *= 0.5; // brace!
  moraleCheck(ctx, target, 'charge', penalty);
}

// ---------------------------------------------------------------------------
// Ranged
// ---------------------------------------------------------------------------

const COVER_HIT_PENALTY = 0.2;

/** A ranged volley from `c` at `target`. Consumes one ammo. */
export function rangedVolley(ctx: BattleContext, c: Combatant, target: Combatant): void {
  const r = c.def.combat.ranged;
  if (!r || c.ammo <= 0 || c.figures <= 0 || target.figures <= 0) return;

  let evasion = target.def.combat.discipline * EVASION_PER_DISCIPLINE;
  if (target.status === 'routing') evasion += EVASION_ROUTING;
  let pHit = clamp(HIT_BASE + HIT_K * (r.attack - evasion), HIT_FLOOR, HIT_CEIL);
  if (isCover(ctx.field, target.x, target.y)) pHit = Math.max(HIT_FLOOR, pHit - COVER_HIT_PENALTY);
  const perHit = Math.max(1, r.damage - target.def.combat.armor);

  // Ranged fire is NOT frontage-limited: every bow in the formation may loose.
  // Accuracy (pHit) already scales the volume of hits, so massed archery stays
  // proportionate to the number firing. Batched to avoid a draw per arrow.
  const landed = sampleBinomial(ctx.rng, c.figures, pHit);
  c.ammo -= 1;
  c.facing = dirIndexTo(c.x, c.y, target.x, target.y);

  ctx.events.push({
    type: 'volley',
    tick: ctx.tick,
    unitId: c.id,
    targetId: target.id,
    from: { x: c.x, y: c.y },
    to: { x: target.x, y: target.y },
    figuresFiring: c.figures,
    hits: landed,
    ammoLeft: c.ammo,
  });

  const res = applyDamage(target, landed * perHit);
  ctx.events.push({
    type: 'damage',
    tick: ctx.tick,
    targetId: target.id,
    sourceId: c.id,
    kind: 'ranged',
    amount: landed * perHit,
    figuresLost: res.figuresLost,
    figuresAfter: target.figures,
    hpAfter: totalHp(target),
    at: { x: target.x, y: target.y },
  });
  if (res.destroyed) {
    ctx.events.push({ type: 'death', tick: ctx.tick, unitId: target.id, at: { x: target.x, y: target.y } });
    ctx.occ.delete(occKey(target.x, target.y));
  } else if (res.figuresLost > 0) {
    recordCasualties(target, res.figuresLost, 'casualties');
  }
}

// ---------------------------------------------------------------------------
// The tick loop
// ---------------------------------------------------------------------------

function aliveOnField(ctx: BattleContext, side: Combatant['side']): Combatant[] {
  return ctx.combatants.filter((c) => c.side === side && c.figures > 0 && c.status !== 'fled');
}

/** True once one side has no units left standing on the field. */
function decided(ctx: BattleContext): boolean {
  return aliveOnField(ctx, 'attacker').length === 0 || aliveOnField(ctx, 'defender').length === 0;
}

function initiativeOrder(ctx: BattleContext): Combatant[] {
  return ctx.combatants
    .filter((c) => c.figures > 0 && c.status !== 'fled')
    .slice()
    .sort((a, b) => {
      if (b.def.combat.speed !== a.def.combat.speed) return b.def.combat.speed - a.def.combat.speed;
      if (a.side !== b.side) return a.side === 'attacker' ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
}

/** Runs the battle to completion, filling ctx.events. Returns the final tick. */
export function runEngine(ctx: BattleContext): number {
  let tick = 0;
  for (; tick < MAX_TICKS; tick++) {
    ctx.tick = tick + 1;
    if (decided(ctx)) break;

    // Baseline each unit's strength for this tick's proportional morale check.
    for (const c of ctx.combatants) {
      c.figuresAtTickStart = c.figures;
      c.lostThisTick = 0;
      c.worstCasualtyTrigger = null;
    }

    const order = initiativeOrder(ctx);
    for (const c of order) {
      if (c.figures <= 0 || c.status === 'fled') continue;
      if (c.status === 'routing') {
        tryRally(ctx, c);
        if (c.status === 'routing') {
          flee(ctx, c);
          continue;
        }
      }
      if (c.figures > 0 && c.status === 'fighting') takeTurn(ctx, c);
      if (decided(ctx)) break;
    }

    endOfTickEffects(ctx);
    // Proportional casualty morale (this tick's toll), then fear auras, then
    // rout contagion so a fresh break can ripple through the neighbouring line.
    applyCasualtyMorale(ctx);
    applyFearAuras(ctx);
    applyRoutContagion(ctx);

    // Record contact for next tick's fresh-contact detection.
    for (const c of ctx.combatants) {
      c.engagedLast = adjacentEnemies(ctx, c).map((e) => e.id);
    }
    if (decided(ctx)) {
      ctx.tick = tick + 1;
      break;
    }
  }
  return Math.min(ctx.tick, MAX_TICKS);
}
