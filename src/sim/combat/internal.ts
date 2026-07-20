/**
 * Internal runtime types, geometry, and tuning constants shared by the combat
 * engine modules (engine / ai / morale / abilities). None of this is part of
 * the public API — the public surface is `battle.ts` (runBattle) and the
 * `events.ts` schema. Kept in its own module so engine/ai/morale/abilities can
 * all depend on it without import cycles.
 *
 * Everything here is deterministic and headless: no Math.random, no Date.now,
 * no imports from render/ui/data. All randomness flows through the injected
 * Rng (see src/sim/core/rng.ts).
 */

import type { UnitDef, AbilityDef, PlaneId } from '../types';
import type { TerrainId } from '../map/tiles';
import type { Rng } from '../core/rng';
import type { BattleEvent } from './events';

export type Side = 'attacker' | 'defender';

// ---------------------------------------------------------------------------
// Battlefield dimensions & tuning constants (all documented at point of use in
// the engine; gathered here so a balance pass is a single-file edit).
// ---------------------------------------------------------------------------

export const BATTLE_WIDTH = 20;
export const BATTLE_HEIGHT = 14;
export const MAX_TICKS = 200;

/** To-hit curve. pHit = clamp(BASE + K*(attack - evasion), FLOOR, CEIL). */
export const HIT_BASE = 0.5;
export const HIT_K = 0.09;
export const HIT_FLOOR = 0.08;
export const HIT_CEIL = 0.95;

/** Evasion (defence-to-be-hit) is derived from discipline, never from armor
 *  (armor is flat damage soak) and never from skill (skill is behaviour, not a
 *  hidden to-hit stat). Context modifiers are added on top. */
export const EVASION_PER_DISCIPLINE = 0.06;
export const EVASION_FLANK = -2; // struck from the flank: harder to defend
export const EVASION_REAR = -4; // struck from behind: much harder
export const EVASION_ROUTING = -5; // a fleeing unit barely defends itself

/** Melee attack-value bonuses from position. Emergent, not tag-based. */
export const ATTACK_FLANK_BONUS = 2;
export const ATTACK_REAR_BONUS = 4;
export const PACK_HUNTER_BONUS = 3; // only when flanking with another pack-hunter

/** Charge: extra damage per landed blow and a morale shock scaled by momentum. */
export const CHARGE_MIN_TILES = 2; // must cover ground to count as a charge
export const CHARGE_MORALE_PENALTY_K = 3; // × charge ability bonus
export const CHARGE_MOMENTUM_K = 1; // × (mass × speed)

// ---------------------------------------------------------------------------
// Geometry — square grid, 8-neighbour, Chebyshev distance (matches the
// strategic map's movement model in src/sim/units).
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

/** 8-neighbour offsets in a fixed order; index === compass direction 0..7. */
export const DIRS: readonly [number, number][] = [
  [1, 0], // 0 E
  [1, 1], // 1 SE
  [0, 1], // 2 S
  [-1, 1], // 3 SW
  [-1, 0], // 4 W
  [-1, -1], // 5 NW
  [0, -1], // 6 N
  [1, -1], // 7 NE
];

export function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Compass direction index (0..7) pointing from (ax,ay) toward (bx,by). */
export function dirIndexTo(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.sign(bx - ax);
  const dy = Math.sign(by - ay);
  for (let i = 0; i < DIRS.length; i++) {
    const d = DIRS[i] as [number, number];
    if (d[0] === dx && d[1] === dy) return i;
  }
  return 0;
}

/** Ring distance between two compass directions (0..4; 0 aligned, 4 opposite). */
export function dirDiff(a: number, b: number): number {
  const raw = Math.abs(a - b) % 8;
  return Math.min(raw, 8 - raw);
}

// ---------------------------------------------------------------------------
// Battlefield
// ---------------------------------------------------------------------------

export interface Battlefield {
  plane: PlaneId;
  terrain: TerrainId;
  width: number;
  height: number;
  /** Tiles that block movement (ground units) and line of fire. */
  blocked: Point[];
  /** Tiles granting cover: ranged attacks INTO them are less accurate. */
  cover: Point[];
}

// ---------------------------------------------------------------------------
// Runtime combatant
// ---------------------------------------------------------------------------

export type CombatStatus = 'fighting' | 'routing' | 'dead' | 'fled';

export interface Combatant {
  id: string;
  side: Side;
  def: UnitDef;
  x: number;
  y: number;
  /** Figures currently alive. */
  figures: number;
  /** Hits remaining on the leading (currently-wounded) figure, 1..maxHits. */
  topHp: number;
  maxHits: number;
  maxFigures: number;
  /** Volleys of ammunition remaining. */
  ammo: number;
  /** Current nerve; starts at def.combat.morale, mutated by the battle. */
  morale: number;
  status: CombatStatus;
  /** Compass facing 0..7, or -1 if not yet oriented. */
  facing: number;
  /** Outstanding poison damage still to be dealt (whole points, over ticks). */
  poison: number;
  breathCooldown: number;
  /** Tick of the last fear check, to throttle fear-aura spam. */
  lastFearTick: number;
  /** Tiles moved on this unit's most recent activation (charge detection). */
  movedThisActivation: number;
  /** Ids of enemies this unit was in contact with at the end of last tick. */
  engagedLast: string[];
  /** Whether the unit has ever routed (affects rally messaging only). */
  brokenOnce: boolean;
}

export function abilityOf<T extends AbilityDef['type']>(
  def: UnitDef,
  type: T,
): Extract<AbilityDef, { type: T }> | undefined {
  for (const a of def.abilities) {
    if (a.type === type) return a as Extract<AbilityDef, { type: T }>;
  }
  return undefined;
}

export function hasAbility(def: UnitDef, type: AbilityDef['type']): boolean {
  return def.abilities.some((a) => a.type === type);
}

/** Total remaining hit-point pool of a combatant. */
export function totalHp(c: Combatant): number {
  if (c.figures <= 0) return 0;
  return (c.figures - 1) * c.maxHits + c.topHp;
}

/** Reach priority: higher strikes first on contact. First-strike beats reach. */
export function reachPriority(def: UnitDef): number {
  return def.combat.melee.reach + (hasAbility(def, 'first-strike') ? 2 : 0);
}

/** Undead never test morale and never rout. */
export function checksMorale(def: UnitDef): boolean {
  return !hasAbility(def, 'undead');
}

/**
 * Applies `amount` raw damage to a combatant, killing figures as the pool
 * drains. Returns how many figures died and whether the unit is destroyed.
 * Pure bookkeeping — no events, no morale (the caller owns those).
 */
export function applyDamage(c: Combatant, amount: number): { figuresLost: number; destroyed: boolean } {
  if (amount <= 0 || c.figures <= 0) return { figuresLost: 0, destroyed: c.figures <= 0 };
  let remaining = amount;
  let lost = 0;
  while (remaining > 0 && c.figures > 0) {
    if (remaining >= c.topHp) {
      remaining -= c.topHp;
      c.figures -= 1;
      lost += 1;
      if (c.figures > 0) c.topHp = c.maxHits;
      else c.topHp = 0;
    } else {
      c.topHp -= remaining;
      remaining = 0;
    }
  }
  if (c.figures <= 0) {
    c.figures = 0;
    c.topHp = 0;
    c.status = 'dead';
  }
  return { figuresLost: lost, destroyed: c.figures <= 0 };
}

/** Heals a combatant by `amount`, restoring figures up to its maximum. */
export function healCombatant(c: Combatant, amount: number): number {
  if (amount <= 0 || c.figures <= 0) return 0;
  const before = totalHp(c);
  const cap = c.maxFigures * c.maxHits;
  let pool = Math.min(cap, before + amount);
  const healed = pool - before;
  c.figures = Math.max(1, Math.ceil(pool / c.maxHits));
  c.topHp = pool - (c.figures - 1) * c.maxHits;
  if (c.topHp <= 0) c.topHp = c.maxHits;
  return healed;
}

// ---------------------------------------------------------------------------
// Battle context passed through the engine
// ---------------------------------------------------------------------------

export interface BattleContext {
  rng: Rng;
  field: Battlefield;
  combatants: Combatant[];
  events: BattleEvent[];
  tick: number;
  /** Occupancy index keyed by "x,y" -> combatant id (living units only). */
  occ: Map<string, string>;
}

export function occKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function combatantAt(ctx: BattleContext, x: number, y: number): Combatant | undefined {
  const id = ctx.occ.get(occKey(x, y));
  if (id === undefined) return undefined;
  return ctx.combatants.find((c) => c.id === id);
}

export function isBlocked(field: Battlefield, x: number, y: number): boolean {
  return field.blocked.some((p) => p.x === x && p.y === y);
}

export function isCover(field: Battlefield, x: number, y: number): boolean {
  return field.cover.some((p) => p.x === x && p.y === y);
}

export function inField(field: Battlefield, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < field.width && y < field.height;
}

/** Own map edge a routing unit flees toward (attacker left, defender right). */
export function homeEdgeX(side: Side, field: Battlefield): number {
  return side === 'attacker' ? 0 : field.width - 1;
}

export function livingEnemies(ctx: BattleContext, c: Combatant): Combatant[] {
  return ctx.combatants.filter((o) => o.side !== c.side && o.figures > 0);
}

export function livingAllies(ctx: BattleContext, c: Combatant): Combatant[] {
  return ctx.combatants.filter((o) => o.side === c.side && o.id !== c.id && o.figures > 0);
}
