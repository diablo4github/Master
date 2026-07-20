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
import type { BattleEvent, MoraleTrigger } from './events';

export type Side = 'attacker' | 'defender';

// ---------------------------------------------------------------------------
// Battlefield dimensions & tuning constants (all documented at point of use in
// the engine; gathered here so a balance pass is a single-file edit).
// ---------------------------------------------------------------------------

export const BATTLE_WIDTH = 20;
export const BATTLE_HEIGHT = 14;
/**
 * Tick cap. Regiment-scale battles GRIND: only the fighting front of a
 * formation trades blows each tick (see frontage below), so a decisive fight
 * runs ~15-60 ticks and even a stubborn one stays well under this cap. Raised
 * from the old 6-figure-squad value (200) to leave head-room for big lines.
 */
export const MAX_TICKS = 400;

// ---------------------------------------------------------------------------
// FRONTAGE — the heart of regiment-scale realism.
//
// A 400-man regiment cannot all strike at once: it fights across a FRONT. Each
// tick, a melee exchange engages only the figures that can physically bring a
// weapon to bear on the contacted face.
//
//   engaged = clamp( min(BASE_FRONTAGE, presentedFront(target)) * faceWidth,
//                    1, attacker.figures )
//
//  - BASE_FRONTAGE: how many of the ATTACKER's men fit shoulder-to-shoulder
//    along one tile-face. A tactical tile is ~this many men wide.
//  - presentedFront(target): how much of the TARGET is exposed. A formation
//    fills the whole face (BASE_FRONTAGE). A SINGULAR great monster is one
//    body — only a mass-scaled crowd of ~10-20 men can hack at one dragon.
//  - faceWidth: extra contact faces widen the fighting front. A flank contact
//    wraps a side (+FLANK), a rear contact wraps around (+REAR), a pack-mate
//    pressing the same prey opens another face (+PACK). MORE ENGAGED FIGURES is
//    now *why flanking kills* — on top of the existing to-hit/evasion swing.
//
// Because only the front trades, casualties accrue a slice at a time and lines
// grind instead of annihilating in 2-3 exchanges. Ranged fire is not frontage-
// limited against a FORMATION (every bow may loose at massed ranks) but IS
// saturation-limited against a lone great beast (see RANGED SATURATION below);
// area effects (breath / a trampler's swath) reap whole swaths of massed ranks
// (see abilities.ts and TRAMPLE below).
// ---------------------------------------------------------------------------

/** Men per tile-face a formation can bring to bear in one melee exchange. */
export const BASE_FRONTAGE = 50;
/** Attackers that can crowd ONE point of a lone target's mass (a dragon is big). */
export const MONSTER_CROWD_PER_MASS = 2;
/** At least this many men can always gang up on a singular monster. */
export const MIN_CROWD = 8;
/** Extra contact-face fraction from a flank / rear / pack-mate. */
export const FLANK_EXTRA_FACE = 0.5;
export const REAR_EXTRA_FACE = 1.0;
export const PACK_EXTRA_FACE = 0.5;
/** Binomial draws at or below this size are rolled exactly; larger are batched. */
export const BINOMIAL_EXACT_MAX = 24;

// ---------------------------------------------------------------------------
// RANGED SATURATION — the geometry of shooting a single great beast.
//
// A 340-bow regiment volleys at a FORMATION and every arrow finds a rank to
// fall on: massed ranks present an effectively unbounded mark, so the whole
// volley tells and accuracy alone scales the hits (see rangedVolley). But a
// SINGULAR great monster is one body standing in the field. Most of a
// 340-arrow volley cannot aim usefully at a lone wyvern — arrows that would
// "hit" its tile sail past empty air to either side. Only a mass-scaled arc of
// the volley gets a real chance at the beast:
//
//   effectiveFirers        = min(figures, saturation(target))
//   saturation(formation)  = ∞                       (spread ranks: full volley)
//   saturation(lone beast) = BASE + mass × PER_MASS  (its presented bulk)
//
// A wyvern (mass 2) eats ~46 aimed shots' worth of chance per volley, not 340;
// a hill giant (mass 5), a bigger silhouette, ~70. THIS is why massed archery
// cannot cheaply delete a great monster (DESIGN.md "Mundane vs mythic"): the
// volley SATURATES and the rest of the arrows are wasted on air. Saturation is
// a property of the TARGET's bulk, never a bonus-vs-tag — a big formation of
// men and a swarm of beasts both present a full mark; only a lone body does not.
// ---------------------------------------------------------------------------

/** Aimed shots a lone beast presents before its own bulk, per volley. */
export const RANGED_SATURATION_BASE = 24;
/** Extra aimed shots per point of the beast's mass (a bigger silhouette). */
export const RANGED_SATURATION_PER_MASS = 8;

// ---------------------------------------------------------------------------
// RANGED ARMOR SOAK. A melee blade grinding at close quarters always finds a
// gap (melee keeps its min-1). An arrow does not: one that cannot defeat the
// armor simply glances off. Per landed arrow, against the target's flat armor:
//
//   surplus = ranged.damage − armor
//   surplus ≥ 1 : every arrow deals `surplus`      (clean punch-through, no min-1)
//   surplus ≤ 0 : SOAKED — only arrows that find a weak joint tell, at a pierce
//                 CHANCE that starts at RANGED_PIERCE_BASE when the armor merely
//                 equals the arrow and falls geometrically (× RANGED_PIERCE_
//                 FALLOFF per further point of armor). Each such arrow deals 1 —
//                 an armor-piercing residue so attrition still converges on a
//                 monster nobody can otherwise scratch.
//
// A hill giant (armor 3) shrugs off orc bows (damage 2 → deficit 1) almost
// entirely; arrows that merely match a foe's armor (deficit 0) still bleed it,
// which is what keeps archers lethal to ordinary armored infantry (kiting).
// ---------------------------------------------------------------------------

/** Pierce chance for a soaked arrow when armor exactly equals the arrow. */
export const RANGED_PIERCE_BASE = 0.5;
/** Pierce chance multiplier for each further point armor exceeds the arrow. */
export const RANGED_PIERCE_FALLOFF = 0.12;

/**
 * A fast, aerial target is hard to hit with massed arrows — emergent evasion
 * vs RANGED only. (Melee reach still governs who can touch a flyer at all; this
 * is not that. It is why a diving wyvern, unlike a plodding armored regiment of
 * the same nominal armor, is not simply feathered out of the sky.)
 */
export const EVASION_FLYING_VS_RANGED = 7;

// ---------------------------------------------------------------------------
// TRAMPLE — a singular great monster's melee is not one duelist's blow. A hill
// giant wading into a shield wall bowls a SWATH of men over with every swing
// (the melee analog of a breath sweep). Left to the plain frontage model a lone
// giant would swing as ONE figure and merely tickle a 400-man regiment; trample
// widens its effective attack front to a mass-scaled swath, so one giant reaps
// dozens over a few ticks — bloody enough to break a green line's nerve. Armor
// and the min-1 melee rule still apply to each figure caught, so it is attrition
// through massed ranks, not an armor-ignoring blast like breath.
// ---------------------------------------------------------------------------

/** Figures a trampler's swing sweeps through a formation, per point of mass. */
export const TRAMPLE_SWEEP_PER_MASS = 1.0;

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
/**
 * "Set against charge": a reach-2 line braced to receive a charge does bonus
 * damage on its opportunity strike — the charger's own momentum (mass × speed)
 * impales it on the spears. This is why spears blunt cavalry, emergently, with
 * no anti-cavalry tag anywhere.
 */
export const IMPALE_K = 0.2; // × (charger mass × speed), added to the brace strike

/**
 * Casualty morale at regiment scale is PROPORTIONAL, never per-figure. A unit
 * tests its nerve at end of tick when either a single tick was bloody
 * (≥ MORALE_TICK_FRACTION of its start-of-tick strength lost) or cumulative
 * attrition has crossed the floor. The shock penalty scales with the fraction
 * lost this tick and with overall depletion — a fresh regiment shrugs off a
 * skirmish, a half-dead one breaks on far less.
 */
export const MORALE_TICK_FRACTION = 0.08; // ≥8% lost in a tick ⇒ nerve check
export const MORALE_ATTRITION_FLOOR = 0.34; // …or once a third of the unit is gone
export const CASUALTY_BASE = 6; // flat shock of taking casualties at all
export const CASUALTY_TICK_K = 110; // × fraction lost THIS tick
export const CASUALTY_ATTRITION_K = 34; // × overall fraction of the unit lost
/** Contagion: a rout nearby tests the nerve of allies within this radius. */
export const ROUT_CONTAGION_RADIUS = 3;
export const ROUT_CONTAGION_PENALTY = 16;

// ---------------------------------------------------------------------------
// AREA EFFECTS AT SCALE. A breath weapon or a trampling charge does not chip a
// regiment — it carves a swath through massed ranks (line geometry × density).
// Sustained heals (regeneration, holy-aura) mend a fraction of a pool, so they
// scale with the size of the formation they tend. Poison grinds proportionally
// to the number of figures actually envenomed.
// ---------------------------------------------------------------------------

/** Figures a full-density formation exposes to one breath sweep (before density). */
export const BREATH_SWATH = 90;
/** Figure count at which a formation counts as fully dense (density → 1). */
export const BREATH_DENSITY_REF = 140;
/** A near-empty formation is never denser than nothing; floor keeps a sweep real. */
export const BREATH_MIN_DENSITY = 0.15;

/** Heal scaling: a pool this many figures large heals at its authored rate; a
 *  bigger formation mends proportionally more (percent-ish), capped so it can't
 *  runaway. Small/singular units (few figures) keep their authored rate. */
export const HEAL_REF_FIGURES = 40;
export const HEAL_MAX_SCALE = 12;

/** Poison queued per envenomed figure is a fraction of a full per-figure dose;
 *  the DoT then bleeds a proportion of the standing pool each tick. */
export const POISON_PER_FIGURE = 0.5;
export const POISON_TICK_FRACTION = 0.12; // of the outstanding poison pool per tick
export const POISON_TICK_MIN = 2; // but always at least this much

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
  /** Figures alive at the START of the current tick (proportional-morale base). */
  figuresAtTickStart: number;
  /** Figures lost so far during the current tick (any damage source). */
  lostThisTick: number;
  /** The most severe positional trigger behind this tick's casualties. */
  worstCasualtyTrigger: MoraleTrigger | null;
  /** Tick on which this unit last broke (for one-pass rout contagion), or -1. */
  routedTick: number;
}

/** Positional casualty triggers, worst-first, for morale attribution. */
const TRIGGER_SEVERITY: Record<string, number> = { casualties: 0, flank: 1, rear: 2 };

/** Records `lost` casualties this tick on `c`, keeping the worst trigger seen. */
export function recordCasualties(c: Combatant, lost: number, trigger: MoraleTrigger): void {
  if (lost <= 0) return;
  c.lostThisTick += lost;
  const cur = c.worstCasualtyTrigger;
  if (cur === null || (TRIGGER_SEVERITY[trigger] ?? 0) > (TRIGGER_SEVERITY[cur] ?? 0)) {
    c.worstCasualtyTrigger = trigger;
  }
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
 * How many enemy figures can physically engage this unit at one tile-face.
 * A formation (≥2 figures) fills the whole face; a SINGULAR great monster is a
 * single body a mass-scaled crowd can hack at (a dragon presents ~16, not 50).
 */
export function presentedFront(target: Combatant): number {
  if (target.figures >= 2) return BASE_FRONTAGE;
  const crowd = Math.round(target.def.combat.mass * MONSTER_CROWD_PER_MASS);
  return Math.max(MIN_CROWD, Math.min(BASE_FRONTAGE, crowd));
}

/**
 * How many of a volley's arrows can meaningfully AIM at `target` this shot. A
 * formation (≥2 figures) presents an unbounded mark — the whole volley may
 * loose (accuracy scales the hits). A SINGULAR great beast presents only its
 * mass-scaled bulk, so most of a big regiment's arrows sail past it (see the
 * RANGED SATURATION block above). This is the sole reason massed archery cannot
 * cheaply delete a great monster — geometry, never a bonus-vs-tag.
 */
export function rangedSaturation(target: Combatant): number {
  if (target.figures >= 2) return Number.POSITIVE_INFINITY;
  return RANGED_SATURATION_BASE + target.def.combat.mass * RANGED_SATURATION_PER_MASS;
}

/**
 * Figures of `attacker` that actually swing at `target` this exchange, given
 * `faceWidth` (1 frontal, wider when flanking/packing). See the FRONTAGE block
 * above: min of the attacker's own frontage and the target's exposed front,
 * widened by contact faces, never more than the attacker has left.
 */
export function engagedFigures(attacker: Combatant, target: Combatant, faceWidth: number): number {
  const cap = Math.min(BASE_FRONTAGE, presentedFront(target)) * faceWidth;
  return Math.max(1, Math.min(attacker.figures, Math.round(cap)));
}

/**
 * Deterministic batched binomial: how many of `n` figures each landing an
 * independent p=`p` blow actually connect. Rather than loop `n` rng draws (a
 * 400-figure regiment would burn hundreds of draws per exchange), small counts
 * are rolled exactly and large counts use a Gaussian (normal) approximation of
 * the binomial via ONE Box–Muller pair — two rng draws, fully deterministic.
 * Mean = n·p, sd = √(n·p·(1−p)); the sample is rounded and clamped to [0, n].
 */
export function sampleBinomial(rng: Rng, n: number, p: number): number {
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;
  if (n <= BINOMIAL_EXACT_MAX) {
    let k = 0;
    for (let i = 0; i < n; i++) if (rng.next() < p) k += 1;
    return k;
  }
  const mean = n * p;
  const sd = Math.sqrt(n * p * (1 - p));
  const u1 = Math.max(1e-12, rng.next());
  const u2 = rng.next();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  let k = Math.round(mean + z * sd);
  if (k < 0) k = 0;
  if (k > n) k = n;
  return k;
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
