/**
 * Versioned, self-describing BattleEvent schema.
 *
 * The battle viewer (a pure playback layer) is built against THIS schema and
 * nothing else: every event carries a `tick` and enough position/identity data
 * to animate the battle without re-running the simulation. All events are
 * plain JSON-serializable objects.
 *
 * Versioning: bump BATTLE_EVENT_SCHEMA_VERSION on any breaking change to the
 * event shapes; the version is stamped into the `battle-start` event so a saved
 * replay can be validated against the viewer that reads it.
 */

import type { UnitRole, AbilityDef, PlaneId } from '../types';
import type { TerrainId } from '../map/tiles';

export const BATTLE_EVENT_SCHEMA_VERSION = 1;

export type BattleSideId = 'attacker' | 'defender';
export type BattleWinner = 'attacker' | 'defender' | 'draw';

export interface EventPoint {
  x: number;
  y: number;
}

/** Immutable snapshot of a unit, emitted once in `battle-start`. */
export interface UnitSummary {
  id: string;
  side: BattleSideId;
  name: string;
  defId: string;
  role: UnitRole;
  /** Figures at battle start. */
  figures: number;
  /** Hit points per figure. */
  hits: number;
  /** figures × hits at start (the full pool this battle began with). */
  maxHp: number;
  /** Hit points actually present at start (may be < maxHp for a wounded unit). */
  startHp: number;
  skill: number;
  speed: number;
  armor: number;
  mass: number;
  reach: 1 | 2;
  morale: number;
  discipline: number;
  hasRanged: boolean;
  range: number;
  ammo: number;
  abilities: readonly AbilityDef[];
  start: EventPoint;
}

export interface BattlefieldSummary {
  plane: PlaneId;
  terrain: TerrainId;
  width: number;
  height: number;
  blocked: EventPoint[];
  cover: EventPoint[];
}

/** Emitted once, first, with everything a viewer needs to draw the field. */
export interface BattleStartEvent {
  type: 'battle-start';
  tick: 0;
  schemaVersion: number;
  field: BattlefieldSummary;
  units: UnitSummary[];
}

export type MoveReason = 'advance' | 'charge' | 'kite' | 'flee' | 'reposition' | 'pursue';

export interface MoveEvent {
  type: 'move';
  tick: number;
  unitId: string;
  from: EventPoint;
  to: EventPoint;
  /** Full step-by-step path (excluding the start tile) for smooth animation. */
  path: EventPoint[];
  reason: MoveReason;
  /** Compass facing 0..7 after the move. */
  facing: number;
}

/** A ranged volley (the shooting action; resulting damage is a DamageEvent). */
export interface VolleyEvent {
  type: 'volley';
  tick: number;
  unitId: string;
  targetId: string;
  from: EventPoint;
  to: EventPoint;
  figuresFiring: number;
  /** Individual figure-shots that landed. */
  hits: number;
  ammoLeft: number;
}

/** A melee attack (the striking action; resulting damage is a DamageEvent). */
export interface MeleeEvent {
  type: 'melee';
  tick: number;
  unitId: string;
  targetId: string;
  at: EventPoint;
  figuresAttacking: number;
  hits: number;
  /** Position/timing modifiers that applied to this strike. */
  charge: boolean;
  flank: boolean;
  rear: boolean;
  firstStrike: boolean;
}

export type DamageKind = 'melee' | 'ranged' | 'poison' | 'breath' | 'charge' | 'opportunity';

export interface DamageEvent {
  type: 'damage';
  tick: number;
  targetId: string;
  /** Source unit, or null for effects without an actor (rare). */
  sourceId: string | null;
  kind: DamageKind;
  amount: number;
  figuresLost: number;
  figuresAfter: number;
  hpAfter: number;
  at: EventPoint;
}

/** A heal (holy-aura, regeneration, life-drain) — negative "damage". */
export interface HealEvent {
  type: 'heal';
  tick: number;
  targetId: string;
  sourceId: string | null;
  kind: 'regeneration' | 'holy-aura' | 'life-drain';
  amount: number;
  figuresAfter: number;
  hpAfter: number;
  at: EventPoint;
}

export interface AbilityProcEvent {
  type: 'ability-proc';
  tick: number;
  ability: AbilityDef['type'];
  sourceId: string;
  targetIds: string[];
  at: EventPoint;
  /** Optional free-form magnitude (e.g. breath damage, pack bonus). */
  magnitude?: number;
}

export type MoraleTrigger =
  | 'casualties'
  | 'fear'
  | 'flank'
  | 'rear'
  | 'ally-rout'
  | 'charge';

export interface MoraleCheckEvent {
  type: 'morale-check';
  tick: number;
  unitId: string;
  trigger: MoraleTrigger;
  /** Effective pass threshold (0..100+) after all modifiers. */
  threshold: number;
  /** Rolled value 0..100; passes when roll < threshold. */
  roll: number;
  passed: boolean;
  at: EventPoint;
}

export interface RoutEvent {
  type: 'rout';
  tick: number;
  unitId: string;
  at: EventPoint;
}

export interface RallyEvent {
  type: 'rally';
  tick: number;
  unitId: string;
  at: EventPoint;
}

/** A unit lost its last figure and is removed from the field. */
export interface DeathEvent {
  type: 'death';
  tick: number;
  unitId: string;
  at: EventPoint;
}

/** A routed unit reached its map edge and quit the field alive. */
export interface FleeOffEvent {
  type: 'flee-off';
  tick: number;
  unitId: string;
  at: EventPoint;
}

export interface BattleEndSurvivor {
  id: string;
  hp: number;
}

export interface BattleEndEvent {
  type: 'battle-end';
  tick: number;
  winner: BattleWinner;
  survivors: {
    attacker: BattleEndSurvivor[];
    defender: BattleEndSurvivor[];
  };
}

export type BattleEvent =
  | BattleStartEvent
  | MoveEvent
  | VolleyEvent
  | MeleeEvent
  | DamageEvent
  | HealEvent
  | AbilityProcEvent
  | MoraleCheckEvent
  | RoutEvent
  | RallyEvent
  | DeathEvent
  | FleeOffEvent
  | BattleEndEvent;

// ---------------------------------------------------------------------------
// Public battle I/O (the runBattle contract)
// ---------------------------------------------------------------------------

import type { UnitDef } from '../types';

export interface BattleUnitInput {
  id: string;
  def: UnitDef;
  /** Current hit-point pool (max = def.combat.figures × def.combat.hits). */
  hp: number;
}

export interface BattleSide {
  units: BattleUnitInput[];
}

export interface BattleInput {
  /** 32-bit integer seed; identical input ⇒ identical BattleReport. */
  seed: number;
  attacker: BattleSide;
  defender: BattleSide;
  terrain: { plane: PlaneId; terrain: TerrainId };
}

export interface BattleReport {
  events: BattleEvent[];
  outcome: {
    winner: BattleWinner;
    survivors: {
      attacker: BattleEndSurvivor[];
      defender: BattleEndSurvivor[];
    };
    ticks: number;
  };
}
