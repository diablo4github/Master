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
  effects: string; // structured effects come later; prose for now
  description: string;
}

export interface StudyDef {
  id: string;
  name: string;
  /** Research cost in research points. */
  cost: number;
  requires?: readonly string[];
  effects: string;
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
  | 'settler'
  | 'ship';

export interface UnitDef {
  id: string;
  name: string;
  role: UnitRole;
  /** Race id for mundane units; school id for summons. */
  origin: { race: string } | { school: SchoolId };
  attack: number;
  defense: number;
  hits: number;
  moves: number;
  /** Tactical skill 0–100: drives combat AI quality (formation, kiting, rout). */
  skill: number;
  upkeep: { gold?: number; food?: number; mana?: number };
  /** For summons: casting cost. */
  summonCost?: number;
  abilities: readonly string[];
  description: string;
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
