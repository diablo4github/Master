/**
 * Tactical battlefield generation and initial deployment.
 *
 * The grid (BATTLE_WIDTH × BATTLE_HEIGHT) is generated deterministically from
 * the strategic terrain id: a small per-terrain table decides how many blocking
 * obstacles (rocks, boulders) and how much cover (trees, scrub) to sprinkle,
 * and where — always avoiding the deployment columns so nobody spawns inside a
 * rock. Attacker deploys on the left, defender on the right.
 *
 * Formation quality scales with each side's AVERAGE SKILL: a veteran side forms
 * a clean line with its archers screened behind the infantry and cavalry on the
 * wings; a green side blobs, leaving its archers exposed among the front rank.
 * This is the first place skill becomes visible — before a blow is struck.
 */

import type { TerrainId } from '../map/tiles';
import type { PlaneId } from '../types';
import type { Rng } from '../core/rng';
import {
  BATTLE_WIDTH,
  BATTLE_HEIGHT,
  type Battlefield,
  type Combatant,
  type Point,
  isBlocked,
  hasAbility,
} from './internal';

interface TerrainScatter {
  /** Blocking obstacles (rocks/boulders). */
  obstacles: number;
  /** Cover tiles (trees/scrub) — reduce accuracy of shots fired into them. */
  cover: number;
}

/**
 * Per-terrain scatter table. Open ground is clear; forests are thick cover;
 * mountains/hills are strewn with rock; marsh/swamp offer scattered cover.
 * Every terrain id falls back to a sane default via `scatterFor`.
 */
const SCATTER: Partial<Record<TerrainId, TerrainScatter>> = {
  grassland: { obstacles: 0, cover: 0 },
  'radiant-plain': { obstacles: 0, cover: 0 },
  'ashen-waste': { obstacles: 1, cover: 0 },
  desert: { obstacles: 1, cover: 0 },
  'cinder-flat': { obstacles: 2, cover: 0 },
  'mirror-flat': { obstacles: 0, cover: 0 },
  tundra: { obstacles: 1, cover: 1 },
  bonefield: { obstacles: 2, cover: 1 },
  hills: { obstacles: 4, cover: 1 },
  mountains: { obstacles: 8, cover: 1 },
  'aurora-peaks': { obstacles: 8, cover: 1 },
  'sanctum-spire': { obstacles: 7, cover: 1 },
  blackspire: { obstacles: 7, cover: 1 },
  'brimstone-spire': { obstacles: 7, cover: 1 },
  'canopy-spire': { obstacles: 6, cover: 3 },
  'starlit-void': { obstacles: 6, cover: 0 },
  forest: { obstacles: 2, cover: 8 },
  'gloom-forest': { obstacles: 2, cover: 8 },
  'crystal-forest': { obstacles: 3, cover: 7 },
  'vine-tangle': { obstacles: 2, cover: 9 },
  'cloud-shoal': { obstacles: 0, cover: 2 },
  'gilded-reef': { obstacles: 2, cover: 3 },
  swamp: { obstacles: 2, cover: 4 },
  'bone-marsh': { obstacles: 2, cover: 4 },
  'blood-fen': { obstacles: 2, cover: 5 },
  mossmire: { obstacles: 2, cover: 6 },
  'magma-field': { obstacles: 6, cover: 0 },
  'prism-shard': { obstacles: 4, cover: 2 },
  ocean: { obstacles: 0, cover: 0 },
  shore: { obstacles: 1, cover: 1 },
};

function scatterFor(terrain: TerrainId): TerrainScatter {
  return SCATTER[terrain] ?? { obstacles: 2, cover: 2 };
}

/** Deployment columns are kept clear so units never spawn inside obstacles. */
const DEPLOY_MARGIN = 6;

/** Generates the battlefield: obstacles + cover scattered in the neutral middle. */
export function generateBattlefield(
  plane: PlaneId,
  terrain: TerrainId,
  rng: Rng,
): Battlefield {
  const field: Battlefield = {
    plane,
    terrain,
    width: BATTLE_WIDTH,
    height: BATTLE_HEIGHT,
    blocked: [],
    cover: [],
  };
  const scatter = scatterFor(terrain);
  const taken = new Set<string>();

  // Scatter only in the central band, never in either deployment zone.
  const minX = DEPLOY_MARGIN;
  const maxX = BATTLE_WIDTH - DEPLOY_MARGIN - 1;

  const place = (target: Point[], count: number): void => {
    for (let i = 0; i < count; i++) {
      // Bounded attempts keep generation deterministic and terminating.
      for (let attempt = 0; attempt < 8; attempt++) {
        const x = rng.int(minX, maxX + 1);
        const y = rng.int(0, BATTLE_HEIGHT);
        const key = `${x},${y}`;
        if (!taken.has(key)) {
          taken.add(key);
          target.push({ x, y });
          break;
        }
      }
    }
  };

  place(field.blocked, scatter.obstacles);
  place(field.cover, scatter.cover);
  return field;
}

// ---------------------------------------------------------------------------
// Deployment
// ---------------------------------------------------------------------------

function avgSkill(units: Combatant[]): number {
  if (units.length === 0) return 0;
  let s = 0;
  for (const u of units) s += u.def.skill;
  return s / units.length;
}

function isRanged(c: Combatant): boolean {
  return c.def.combat.ranged !== undefined && c.def.combat.ranged.ammo > 0;
}

function isCavalry(c: Combatant): boolean {
  return c.def.role === 'cavalry' || (c.def.combat.speed >= 3 && hasAbility(c.def, 'charge'));
}

/**
 * Stacks units into a single column at `x`, centred on `centerY`, skipping
 * blocked/occupied tiles. Jitter (for green formations) nudges some units into
 * the neighbouring column so the line is ragged.
 */
function placeColumn(
  field: Battlefield,
  used: Set<string>,
  units: Combatant[],
  x: number,
  centerY: number,
  jitterDir: number,
  rng: Rng,
  jitter: boolean,
): void {
  // Interleave outward from the centre: 0, +1, -1, +2, -2 ...
  const order: number[] = [];
  for (let i = 0; i < units.length; i++) {
    const step = Math.ceil(i / 2);
    order.push(i % 2 === 0 ? centerY + step : centerY - step);
  }
  for (let i = 0; i < units.length; i++) {
    const u = units[i] as Combatant;
    let px = x;
    if (jitter && rng.next() < 0.5) px = x + jitterDir; // green: break the column
    let py = order[i] as number;
    // Find the nearest free, in-field, unblocked tile scanning downward.
    let placed = false;
    for (let dy = 0; dy < BATTLE_HEIGHT && !placed; dy++) {
      for (const cand of [py + dy, py - dy]) {
        const cx = Math.min(field.width - 1, Math.max(0, px));
        const cy = Math.min(field.height - 1, Math.max(0, cand));
        const key = `${cx},${cy}`;
        if (!used.has(key) && !isBlocked(field, cx, cy)) {
          u.x = cx;
          u.y = cy;
          used.add(key);
          placed = true;
          break;
        }
      }
    }
  }
}

/**
 * Deploys both sides in place (mutates each combatant's x/y and facing).
 * Attacker faces east (dir 0), defender faces west (dir 4).
 *
 * Veteran layout: melee front rank, ranged screened one column back, cavalry
 * split to the wings. Green layout: everything blobs near the edge with the
 * ranged mixed into the front (exposed) and a jittered line.
 */
export function deploy(field: Battlefield, combatants: Combatant[], rng: Rng): void {
  const used = new Set<string>();
  const centerY = Math.floor(field.height / 2);

  for (const side of ['attacker', 'defender'] as const) {
    const units = combatants.filter((c) => c.side === side);
    const skill = avgSkill(units);
    const green = skill < 35;
    const facing = side === 'attacker' ? 0 : 4;
    for (const u of units) u.facing = facing;

    const melee = units.filter((c) => !isRanged(c) && !isCavalry(c));
    const ranged = units.filter((c) => isRanged(c));
    const cavalry = units.filter((c) => isCavalry(c) && !isRanged(c));

    // Column layout, mirrored per side. Front is nearer the centre of the map.
    const frontX = side === 'attacker' ? 5 : field.width - 6;
    const backX = side === 'attacker' ? 3 : field.width - 4;
    const jitterDir = side === 'attacker' ? -1 : 1; // green units drift backward

    if (green) {
      // Everyone blobs at the front, ranged exposed among them, ragged line.
      placeColumn(field, used, [...melee, ...ranged, ...cavalry], frontX, centerY, jitterDir, rng, true);
    } else {
      // Clean line: melee up front, cavalry on the wings of the front column,
      // ranged safely one column back.
      const wingTop = [...cavalry.filter((_, i) => i % 2 === 0)];
      const wingBot = [...cavalry.filter((_, i) => i % 2 === 1)];
      placeColumn(field, used, melee, frontX, centerY, jitterDir, rng, false);
      // Cavalry to the extreme rows of the front column.
      placeColumn(field, used, wingTop, frontX, 1, jitterDir, rng, false);
      placeColumn(field, used, wingBot, frontX, field.height - 2, jitterDir, rng, false);
      placeColumn(field, used, ranged, backX, centerY, jitterDir, rng, false);
    }
  }
}
