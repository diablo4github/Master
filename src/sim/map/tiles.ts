/**
 * Tile model shared by all 8 planes.
 *
 * Kept intentionally minimal and JSON-serializable. `ocean`/`shore` are
 * universal across every plane; the remaining ids are grouped by the plane
 * (or plane family) whose terrain table dominantly uses them — see
 * `src/sim/map/mapgen.ts` for the per-plane terrain tables that decide which
 * ids are legal on which plane.
 */

import type { PlaneId } from '../types';

export type TerrainId =
  // Universal
  | 'ocean'
  | 'shore'
  // Meridia (normal world, temperate/varied)
  | 'grassland'
  | 'forest'
  | 'hills'
  | 'mountains'
  | 'desert'
  | 'swamp'
  | 'tundra'
  // Umbra (dark world)
  | 'ashen-waste'
  | 'bonefield'
  | 'gloom-forest'
  // Lumina (light world)
  | 'radiant-plain'
  | 'crystal-forest'
  | 'aurora-peaks'
  // Empyrean (Life dimension)
  | 'cloud-shoal'
  | 'gilded-reef'
  | 'sanctum-spire'
  // Charnel Deep (Death dimension)
  | 'bone-marsh'
  | 'blood-fen'
  | 'blackspire'
  // Maelstrom (Chaos dimension)
  | 'cinder-flat'
  | 'magma-field'
  | 'brimstone-spire'
  // Wildroot (Nature dimension)
  | 'vine-tangle'
  | 'mossmire'
  | 'canopy-spire'
  // Aether (Sorcery dimension)
  | 'mirror-flat'
  | 'prism-shard'
  | 'starlit-void';

/** Elevation tier, coarse and deterministic: 0 water, 1 lowland, 2 hill, 3 peak. */
export type ElevationTier = 0 | 1 | 2 | 3;

export interface Tile {
  terrain: TerrainId;
  elevation?: ElevationTier;
  /** Freeform tag for special map features (ruins, lairs, nodes, ...). Added by later systems. */
  feature?: string;
  /** Resource id present on this tile, if any. Added by later systems. */
  resource?: string;
}

export interface PlaneMap {
  plane: PlaneId;
  width: number;
  height: number;
  /** Row-major, length === width * height. Index via xyToIndex/indexToXY below. */
  tiles: Tile[];
}

// ---------------------------------------------------------------------------
// Index helpers — square grid, 8-neighbor, no wraparound.
// ---------------------------------------------------------------------------

export function xyToIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

export function indexToXY(index: number, width: number): { x: number; y: number } {
  return { x: index % width, y: Math.floor(index / width) };
}

export function inBounds(x: number, y: number, width: number, height: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

export function getTile(map: PlaneMap, x: number, y: number): Tile | undefined {
  if (!inBounds(x, y, map.width, map.height)) return undefined;
  return map.tiles[xyToIndex(x, y, map.width)];
}

const NEIGHBOR_OFFSETS: readonly [number, number][] = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

/** The (up to 8) in-bounds neighbor coordinates of (x, y). */
export function neighbors(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const [dx, dy] of NEIGHBOR_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny, width, height)) out.push({ x: nx, y: ny });
  }
  return out;
}
