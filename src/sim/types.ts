/**
 * Core domain model for Master.
 *
 * This file is the contract between the sim, the content in src/data, and the
 * presentation layers. It is intentionally conservative: plain serializable
 * data, string-literal ids, no classes. Changes here are lead-developer
 * territory — coordinate before editing.
 */

// ---------------------------------------------------------------------------
// Schools of magic
// ---------------------------------------------------------------------------

export type SchoolId = 'life' | 'death' | 'chaos' | 'nature' | 'sorcery';

export const SCHOOL_IDS: readonly SchoolId[] = [
  'life',
  'death',
  'chaos',
  'nature',
  'sorcery',
];

export interface SchoolDef {
  id: SchoolId;
  name: string;
  /** Display color, hex. Life=white, Death=black, Chaos=red, Nature=green, Sorcery=blue. */
  color: string;
  /** The extra dimension only pure mages of this school can access. */
  dimension: DimensionId;
  /** One-line identity used in UI and to steer content generation. */
  tagline: string;
  /**
   * Summoning philosophy:
   *  - life:   few summons, strongest in the game, hardest/most expensive to cast
   *  - death:  most summons, generally weaker, often via converting mundane
   *            units or population
   *  - others: distinct mid-range flavors
   */
  summonProfile: string;
}

/** Life and Death may never be combined on a single wizard. */
export function isLegalSchoolCombo(schools: readonly SchoolId[]): boolean {
  if (schools.length < 1 || schools.length > 3) return false;
  if (new Set(schools).size !== schools.length) return false;
  return !(schools.includes('life') && schools.includes('death'));
}

// ---------------------------------------------------------------------------
// Planes: 3 main worlds + 5 school dimensions = 8 maps
// ---------------------------------------------------------------------------

/** Main worlds. Names are working placeholders pending designer approval. */
export type WorldId = 'meridia' | 'umbra' | 'lumina';

export type DimensionId =
  | 'empyrean' // Life
  | 'charnel-deep' // Death
  | 'maelstrom' // Chaos
  | 'wildroot' // Nature
  | 'aether'; // Sorcery

export type PlaneId = WorldId | DimensionId;

export const WORLD_IDS: readonly WorldId[] = ['meridia', 'umbra', 'lumina'];

export interface PlaneDef {
  id: PlaneId;
  name: string;
  kind: 'world' | 'dimension';
  /** For dimensions: the school whose pure mages can enter. */
  school?: SchoolId;
  /** For worlds: schools whose magic thrives here (casting/economy bonuses). */
  thrivingSchools: readonly SchoolId[];
  description: string;
}

// ---------------------------------------------------------------------------
// Wizards & retorts (perks)
// ---------------------------------------------------------------------------

export interface RetortDef {
  id: string;
  name: string;
  description: string;
  /** Cost in perk points during wizard customization. */
  cost: number;
  /** Constraints, e.g. requires a school, or grants an alternate start world. */
  requiresSchool?: SchoolId;
  /** Retort that unlocks starting in a non-default world. */
  grantsStartWorld?: WorldId;
}

export interface WizardDef {
  id: string;
  name: string;
  /** 1–3 schools; must satisfy isLegalSchoolCombo. */
  schools: readonly SchoolId[];
  /** Default retort loadout tuned to this build. Player may customize these. */
  retorts: readonly string[];
  /** Flavor bio shown on the selection screen. */
  bio: string;
}

/**
 * Which worlds a wizard with these schools may legally START in.
 * Everyone may start in Meridia. Umbra/Lumina require the matching start
 * retort, and: Death wizards can never start in Lumina; Life wizards can
 * never start in Umbra.
 */
export function legalStartWorlds(schools: readonly SchoolId[]): WorldId[] {
  const worlds: WorldId[] = ['meridia'];
  if (!schools.includes('life')) worlds.push('umbra');
  if (!schools.includes('death')) worlds.push('lumina');
  return worlds;
}

// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------

export interface RaceDef {
  id: string;
  name: string;
  /** Native world. 18 races in meridia, 6 in umbra, 6 in lumina. */
  homeWorld: WorldId;
  /** Baseline race for its world? Orcs are THE generic race (meridia). */
  generic?: boolean;
  /** Population growth modifier, 1.0 = orc baseline. */
  growthRate: number;
  /** Per-population yield modifiers, 1.0 = orc baseline. */
  yields: {
    food: number;
    production: number;
    gold: number;
    /** Magical research — the only research axis in the game. */
    research: number;
    mana: number;
  };
  /** School this race leans toward (e.g. humans -> life), if any. */
  schoolAffinity?: SchoolId;
  /** Building ids this race can construct. Diversity beyond MoM is the goal. */
  buildings: readonly string[];
  /** Ids of this race's unique magical-study tech tree nodes. */
  studies: readonly string[];
  description: string;
}

// ---------------------------------------------------------------------------
// Yields & effects (shared by buildings and studies)
// ---------------------------------------------------------------------------

/** The five per-turn resources a city produces. */
export interface YieldBundle {
  food: number;
  production: number;
  gold: number;
  /** Magical research — the only research axis in the game. */
  research: number;
  mana: number;
}

export type YieldKey = keyof YieldBundle;

/**
 * Structured, sim-consumable effects. All fields optional; omitted = no
 * effect on that axis. Multipliers stack multiplicatively, flats stack
 * additively, flats apply before multipliers.
 */
export interface CityEffects {
  /** Flat per-turn yield added to the city. */
  yields?: Partial<YieldBundle>;
  /** Yield multipliers, 1.0 = no change (e.g. marketplace gold 1.25). */
  yieldMultipliers?: Partial<YieldBundle>;
  /** Additive bonus to the city's population growth rate (0.1 = +10%). */
  growthBonus?: number;
  /** Raises the city's maximum population. */
  housing?: number;
  /** Flat defense added to the city garrison in sieges. */
  defenseBonus?: number;
  /**
   * Points of unrest suppressed (temples are the classic source). The unrest
   * system lands with the empire-management milestone; data ships now.
   */
  unrestReduction?: number;
}

export interface StudyEffects {
  /** Empire-wide per-turn yields (applied to every owned city). */
  cityEffects?: CityEffects;
  /** Building ids this study unlocks for construction. */
  unlocksBuildings?: readonly string[];
  /** Unit ids this study unlocks for training. */
  unlocksUnits?: readonly string[];
}

// ---------------------------------------------------------------------------
// Buildings & magical studies (research)
// ---------------------------------------------------------------------------

export interface BuildingDef {
  id: string;
  name: string;
  tier: number;
  /** Building that must exist first, if any. */
  requires?: string;
  cost: number;
  upkeep: number;
  effects: CityEffects;
  description: string;
}

export interface StudyDef {
  id: string;
  name: string;
  /** Research cost in research points. */
  cost: number;
  requires?: readonly string[];
  effects: StudyEffects;
  description: string;
}

// ---------------------------------------------------------------------------
// Units & summons
// ---------------------------------------------------------------------------

export type UnitRole =
  | 'infantry'
  | 'ranged'
  | 'cavalry'
  | 'siege'
  | 'hero'
  | 'summon'
  /** Neutral wilderness creatures (lair garrisons, rampagers). */
  | 'monster'
  | 'settler'
  | 'ship';

/**
 * Typed ability vocabulary. Every entry here is IMPLEMENTED in the combat
 * engine — content may only use these. Counters must stay emergent (physics
 * of the fiction); never add a "bonus vs <role>" ability.
 * Magnitude range is intentional: poison is a small effect, breath-weapon
 * rewrites a battle.
 */
export type AbilityDef =
  | { type: 'flying' } // ignores terrain, can only be struck by reach/ranged/flyers
  | { type: 'first-strike' } // resolves melee before the defender's simultaneous blow
  | { type: 'charge'; bonus: number } // extra impact damage scaling with speed×mass
  | { type: 'poison'; strength: number } // per-hit lingering damage over ticks
  | { type: 'regeneration'; perTick: number } // heals hits each tick, figures can stand back up
  | { type: 'fear'; radius: number } // morale pressure aura on nearby enemies
  | { type: 'inspire'; radius: number; bonus: number } // morale aura for nearby allies
  | { type: 'holy-aura'; radius: number; healPerTick: number } // heals nearby allies
  | { type: 'life-drain'; fraction: number } // melee damage dealt also heals self
  | { type: 'breath-weapon'; damage: number; range: number; cooldown: number } // line blast
  | { type: 'trample' } // may continue moving through a figure it kills
  | { type: 'undead' } // no morale (never routs), immune to poison/fear, no food upkeep
  | { type: 'fearless' } // passes all morale checks (living discipline, not undeath)
  | { type: 'pack-hunter' }; // gains attack when flanking with another pack-hunter

export interface UnitCombatStats {
  /** Figures in the formation (damage kills figures; fewer figures = less output). */
  figures: number;
  /** Hit points per figure. */
  hits: number;
  melee: {
    /** To-hit strength, contested against target defense-in-context. */
    attack: number;
    /** Damage per landed figure-blow. */
    damage: number;
    /** 1 = arm's length; 2 = spear/pike (strikes chargers first). */
    reach: 1 | 2;
  };
  /** Omit for pure melee units. */
  ranged?: {
    attack: number;
    damage: number;
    /** Tactical tiles. */
    range: number;
    /** Volleys before the quiver is empty. */
    ammo: number;
  };
  /** Flat damage soak per blow. */
  armor: number;
  /** Tactical tiles per tick — kiting and charging both live here. */
  speed: number;
  /** Charge physics and shove resistance (a horse is 4, a militiaman is 1). */
  mass: number;
  /** Base nerve 0–100. Checked on casualties, fear, flanking, routs nearby. */
  morale: number;
  /** Formation cohesion 0–100: holding lines, orderly withdrawal, rally odds. */
  discipline: number;
}

export interface UnitDef {
  id: string;
  name: string;
  role: UnitRole;
  /**
   * Race id for race-specific units; school id for summons; generic for
   * units any race can train (e.g. settlers).
   */
  origin: { race: string } | { school: SchoolId } | { generic: true };
  /** Production cost to train (mundane units). */
  cost?: number;
  combat: UnitCombatStats;
  /** Strategic-map movement points. */
  moves: number;
  /** Tactical skill 0–100: drives combat AI quality (formation, kiting, rout). */
  skill: number;
  upkeep: { gold?: number; food?: number; mana?: number };
  /** For summons: casting cost. */
  summonCost?: number;
  abilities: readonly AbilityDef[];
  description: string;
}

// ---------------------------------------------------------------------------
// Runtime entities (cities & units on the map)
// ---------------------------------------------------------------------------

export interface BuildOrder {
  kind: 'building' | 'unit';
  /** Building id or unit id. */
  id: string;
  /** Production points invested so far. */
  progress: number;
}

export interface CityState {
  id: string;
  owner: string;
  name: string;
  raceId: string;
  plane: PlaneId;
  x: number;
  y: number;
  /** Population in thousands (MoM-style 1..N points). */
  population: number;
  /** Food surplus accumulated toward the next population point. */
  growthProgress: number;
  buildings: string[];
  /** Front of the queue is under construction. */
  buildQueue: BuildOrder[];
}

export interface UnitState {
  id: string;
  owner: string;
  defId: string;
  plane: PlaneId;
  x: number;
  y: number;
  /** Movement points remaining this turn. */
  moves: number;
  /**
   * Total remaining hit-point pool (max = figures × hits). Combat derives
   * surviving figures from this; strategic healing refills it.
   */
  hp: number;
}

// ---------------------------------------------------------------------------
// Game state skeleton (fleshed out by the sim engine)
// ---------------------------------------------------------------------------

export interface GameSettings {
  seed: number;
  mapSize: 'small' | 'medium' | 'large' | 'huge';
  players: readonly PlayerSetup[];
}

export interface PlayerSetup {
  wizardId: string;
  /** Customized retort loadout (schools are fixed by the wizard). */
  retorts: readonly string[];
  startWorld: WorldId;
  raceId: string;
  human: boolean;
}
