/**
 * Unit movement: terrain movement costs, A* pathfinding, and point-limited
 * movement along a path.
 *
 * Deterministic and headless like the rest of src/sim. Pathfinding uses an
 * explicit, total ordering for tie-breaking (never object-key iteration) so
 * the same request always yields the same path.
 *
 * Milestone scope: land units only. Ocean and shore are impassable to land
 * units (no ships yet). Movement is stateless about intent — `moveUnit`
 * advances a unit as far as this turn's remaining movement allows and stops;
 * multi-turn travel is the UI layer's concern.
 */

import type { PlaneMap, Tile } from '../map/tiles';
import { getTile, inBounds, xyToIndex } from '../map/tiles';
import type { TerrainId } from '../map/tiles';
import type { UnitState } from '../core/state';

/** Cost, in movement points, to ENTER a tile of each terrain (land units). */
export const IMPASSABLE = Infinity;

/**
 * Movement cost to enter a tile of each terrain. Ocean/shore are impassable
 * to land units (Infinity) until ships arrive. Every one of the 30 terrain
 * ids is listed so the table is exhaustive and typo-safe.
 */
export const MOVE_COSTS: Record<TerrainId, number> = {
  // Universal water — impassable to land units for now.
  ocean: IMPASSABLE,
  shore: IMPASSABLE,
  // Meridia
  grassland: 1,
  forest: 2,
  hills: 2,
  mountains: 3,
  desert: 1,
  swamp: 3,
  tundra: 2,
  // Umbra
  'ashen-waste': 1,
  bonefield: 1,
  'gloom-forest': 2,
  // Lumina
  'radiant-plain': 1,
  'crystal-forest': 2,
  'aurora-peaks': 3,
  // Empyrean (Life)
  'cloud-shoal': 2,
  'gilded-reef': 2,
  'sanctum-spire': 3,
  // Charnel Deep (Death)
  'bone-marsh': 2,
  'blood-fen': 3,
  blackspire: 3,
  // Maelstrom (Chaos)
  'cinder-flat': 1,
  'magma-field': 3,
  'brimstone-spire': 3,
  // Wildroot (Nature)
  'vine-tangle': 2,
  mossmire: 2,
  'canopy-spire': 3,
  // Aether (Sorcery)
  'mirror-flat': 1,
  'prism-shard': 2,
  'starlit-void': 3,
};

/** Movement cost to enter (x, y); Infinity if out of bounds or impassable. */
export function moveCostAt(map: PlaneMap, x: number, y: number): number {
  const tile = getTile(map, x, y);
  if (!tile) return IMPASSABLE;
  return MOVE_COSTS[tile.terrain];
}

/** True if a land unit may stand on / enter this tile. */
export function isPassable(map: PlaneMap, x: number, y: number): boolean {
  return Number.isFinite(moveCostAt(map, x, y));
}

/** Chebyshev distance — the min number of 8-neighbor steps between two tiles. */
export function chebyshev(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

export interface Point {
  x: number;
  y: number;
}

// 8-neighbor offsets in a fixed, explicit order used everywhere movement
// expands neighbors, so tie-breaking is fully deterministic.
const STEP_OFFSETS: readonly [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

interface PathNode {
  index: number;
  x: number;
  y: number;
  g: number; // cost so far
  f: number; // g + heuristic
  order: number; // insertion order — final, stable tie-breaker
  parent: number; // parent tile index, or -1
}

/**
 * A* over the 8-neighbor grid. Diagonals cost the same as orthogonal moves
 * (classic Master of Magic feel); the cost of a step is the cost to ENTER the
 * destination tile. Returns the full tile path INCLUDING the start tile at
 * index 0 and the target as the last element, or null if the target is
 * unreachable (impassable terrain, out of bounds, or walled off).
 *
 * Determinism: the open set is a plain array scanned for the best node with a
 * total ordering (lowest f, then lowest g, then earliest insertion order), so
 * results never depend on Map/Set iteration order.
 */
export function findPath(
  map: PlaneMap,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
): Point[] | null {
  if (!inBounds(sx, sy, map.width, map.height)) return null;
  if (!inBounds(tx, ty, map.width, map.height)) return null;
  if (!isPassable(map, tx, ty)) return null;
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];

  const { width, height } = map;
  const startIdx = xyToIndex(sx, sy, width);
  const targetIdx = xyToIndex(tx, ty, width);

  // Per-tile best-known cost; Infinity = unseen. Plain array, index = tile.
  const bestG = new Array<number>(width * height).fill(IMPASSABLE);
  const parent = new Array<number>(width * height).fill(-1);
  const closed = new Array<boolean>(width * height).fill(false);

  let orderCounter = 0;
  const open: PathNode[] = [];

  const h0 = chebyshev(sx, sy, tx, ty);
  bestG[startIdx] = 0;
  open.push({ index: startIdx, x: sx, y: sy, g: 0, f: h0, order: orderCounter++, parent: -1 });

  while (open.length > 0) {
    // Select the best open node with a total, deterministic ordering.
    let bestI = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i] as PathNode;
      const b = open[bestI] as PathNode;
      if (a.f < b.f || (a.f === b.f && a.g < b.g) || (a.f === b.f && a.g === b.g && a.order < b.order)) {
        bestI = i;
      }
    }
    const current = open.splice(bestI, 1)[0] as PathNode;

    if (current.index === targetIdx) {
      // Reconstruct path from parent chain.
      const path: Point[] = [];
      let idx = current.index;
      while (idx !== -1) {
        path.push({ x: idx % width, y: Math.floor(idx / width) });
        idx = parent[idx] as number;
      }
      path.reverse();
      return path;
    }

    if (closed[current.index]) continue;
    closed[current.index] = true;

    for (const [dx, dy] of STEP_OFFSETS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (!inBounds(nx, ny, width, height)) continue;
      const nIdx = xyToIndex(nx, ny, width);
      if (closed[nIdx]) continue;
      const stepCost = MOVE_COSTS[(map.tiles[nIdx] as Tile).terrain];
      if (!Number.isFinite(stepCost)) continue; // impassable

      const tentativeG = current.g + stepCost;
      if (tentativeG < (bestG[nIdx] as number)) {
        bestG[nIdx] = tentativeG;
        parent[nIdx] = current.index;
        const f = tentativeG + chebyshev(nx, ny, tx, ty);
        open.push({ index: nIdx, x: nx, y: ny, g: tentativeG, f, order: orderCounter++, parent: current.index });
      }
    }
  }

  return null;
}

/**
 * Moves a unit toward (tx, ty) as far as this turn's remaining movement
 * points allow, mutating the unit's position and `moves` in place. Follows
 * the A* path; stops when movement is exhausted or the target is reached.
 *
 * MoM rule: a unit with any movement left may always take at least one step,
 * even onto a tile that costs more than its remaining points (the surplus is
 * simply lost). Returns the remaining path (tiles not yet reached, target
 * last) so callers can display or re-issue continuation, or null if no path
 * exists. The sim itself stores no travel intent.
 */
export function moveUnit(map: PlaneMap, unit: UnitState, tx: number, ty: number): Point[] | null {
  const path = findPath(map, unit.x, unit.y, tx, ty);
  if (!path) return null;

  // path[0] is the unit's current tile; walk forward from index 1.
  let i = 1;
  for (; i < path.length; i++) {
    if (unit.moves <= 0) break;
    const step = path[i] as Point;
    const cost = MOVE_COSTS[(getTile(map, step.x, step.y) as Tile).terrain];
    unit.x = step.x;
    unit.y = step.y;
    unit.moves = Math.max(0, unit.moves - cost);
  }

  const remaining = path.slice(i);
  return remaining;
}
