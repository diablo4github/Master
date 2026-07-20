/**
 * World generation: seeded, dependency-free landmass + terrain generation.
 *
 * Approach (v1, "simple but respectable"):
 *  1. Build an elevation field as the sum of random radial "blobs" (a cheap
 *     value-noise substitute requiring no external libraries), then
 *     normalize to [0, 1].
 *  2. Pick a sea level as an exact quantile of the elevation field so the
 *     resulting land fraction is controlled precisely (not left to chance),
 *     comfortably inside the designed 20-80% land/water bounds.
 *  3. Split land into flat / hill / peak bands via further quantiles of the
 *     land-only elevation distribution.
 *  4. Build a second, independent blob field ("biome") used to pick a
 *     terrain id within each band's weighted candidate list from the
 *     plane's terrain table, giving spatially-clumped (not salt-and-pepper)
 *     terrain patches.
 *  5. Ocean tiles adjacent to land are relabeled `shore`.
 *
 * All randomness is drawn from Rng streams forked off the input rng, keyed
 * by plane id, so generating multiple planes from one Rng never lets one
 * plane's generation perturb another's (see rng.ts fork semantics).
 */

import type { GameSettings, PlaneDef, PlaneId } from '../types';
import type { Rng } from '../core/rng';
import type { ElevationTier, PlaneMap, Tile, TerrainId } from './tiles';
import { neighbors, xyToIndex } from './tiles';

export type MapSize = GameSettings['mapSize'];

const SIZE_DIMENSIONS: Record<MapSize, { width: number; height: number }> = {
  small: { width: 40, height: 40 },
  medium: { width: 64, height: 64 },
  large: { width: 90, height: 90 },
  huge: { width: 120, height: 120 },
};

interface TerrainWeight {
  id: TerrainId;
  weight: number;
}

interface PlaneTerrainTable {
  /** Low-elevation land candidates. */
  flat: readonly TerrainWeight[];
  /** Mid-elevation land candidates. */
  hill: readonly TerrainWeight[];
  /** High-elevation land candidates. */
  peak: readonly TerrainWeight[];
}

/**
 * Per-plane terrain palettes. `ocean`/`shore` are universal and handled
 * separately from these tables. Exported so tests (and later, other sim
 * modules) can validate which terrain ids are legal for a given plane.
 */
export const TERRAIN_TABLES: Record<PlaneId, PlaneTerrainTable> = {
  meridia: {
    flat: [
      { id: 'grassland', weight: 4 },
      { id: 'forest', weight: 3 },
      { id: 'swamp', weight: 1 },
      { id: 'desert', weight: 1 },
      { id: 'tundra', weight: 1 },
    ],
    hill: [
      { id: 'hills', weight: 3 },
      { id: 'forest', weight: 1 },
    ],
    peak: [{ id: 'mountains', weight: 1 }],
  },
  umbra: {
    flat: [
      { id: 'ashen-waste', weight: 3 },
      { id: 'bonefield', weight: 2 },
      { id: 'gloom-forest', weight: 2 },
      { id: 'swamp', weight: 1 },
    ],
    hill: [
      { id: 'bonefield', weight: 2 },
      { id: 'ashen-waste', weight: 1 },
    ],
    peak: [{ id: 'mountains', weight: 1 }],
  },
  lumina: {
    flat: [
      { id: 'radiant-plain', weight: 4 },
      { id: 'crystal-forest', weight: 2 },
      { id: 'grassland', weight: 1 },
    ],
    hill: [
      { id: 'crystal-forest', weight: 2 },
      { id: 'radiant-plain', weight: 1 },
    ],
    peak: [{ id: 'aurora-peaks', weight: 1 }],
  },
  empyrean: {
    flat: [
      { id: 'cloud-shoal', weight: 3 },
      { id: 'gilded-reef', weight: 2 },
    ],
    hill: [
      { id: 'gilded-reef', weight: 2 },
      { id: 'cloud-shoal', weight: 1 },
    ],
    peak: [{ id: 'sanctum-spire', weight: 1 }],
  },
  'charnel-deep': {
    flat: [
      { id: 'bone-marsh', weight: 3 },
      { id: 'blood-fen', weight: 2 },
    ],
    hill: [
      { id: 'blood-fen', weight: 2 },
      { id: 'bone-marsh', weight: 1 },
    ],
    peak: [{ id: 'blackspire', weight: 1 }],
  },
  maelstrom: {
    flat: [
      { id: 'cinder-flat', weight: 3 },
      { id: 'magma-field', weight: 1 },
    ],
    hill: [
      { id: 'magma-field', weight: 3 },
      { id: 'cinder-flat', weight: 1 },
    ],
    peak: [{ id: 'brimstone-spire', weight: 1 }],
  },
  wildroot: {
    flat: [
      { id: 'vine-tangle', weight: 3 },
      { id: 'mossmire', weight: 2 },
    ],
    hill: [
      { id: 'mossmire', weight: 2 },
      { id: 'vine-tangle', weight: 1 },
    ],
    peak: [{ id: 'canopy-spire', weight: 1 }],
  },
  aether: {
    flat: [
      { id: 'mirror-flat', weight: 3 },
      { id: 'prism-shard', weight: 1 },
    ],
    hill: [
      { id: 'prism-shard', weight: 3 },
      { id: 'mirror-flat', weight: 1 },
    ],
    peak: [{ id: 'starlit-void', weight: 1 }],
  },
};

/** The full set of terrain ids that may legally appear on a given plane. */
export function legalTerrainsFor(planeId: PlaneId): Set<TerrainId> {
  const table = TERRAIN_TABLES[planeId];
  const ids = new Set<TerrainId>(['ocean', 'shore']);
  for (const band of [table.flat, table.hill, table.peak]) {
    for (const entry of band) ids.add(entry.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Noise field generation
// ---------------------------------------------------------------------------

/** Sum of random radial falloff blobs, normalized to [0, 1]. Dependency-free value-noise substitute. */
function generateBlobField(rng: Rng, width: number, height: number, numBlobs: number): number[] {
  const field = new Array<number>(width * height).fill(0);
  const minDim = Math.min(width, height);

  for (let i = 0; i < numBlobs; i++) {
    const cx = rng.next() * width;
    const cy = rng.next() * height;
    const radius = minDim * (0.08 + rng.next() * 0.22);
    const amp = 0.5 + rng.next() * 1.0;

    const minX = Math.max(0, Math.floor(cx - radius));
    const maxX = Math.min(width - 1, Math.ceil(cx + radius));
    const minY = Math.max(0, Math.floor(cy - radius));
    const maxY = Math.min(height - 1, Math.ceil(cy + radius));

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x + 0.5 - cx;
        const dy = y + 0.5 - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius) {
          const idx = xyToIndex(x, y, width);
          field[idx] = (field[idx] as number) + amp * (1 - dist / radius);
        }
      }
    }
  }

  return normalizeField(field);
}

function normalizeField(field: readonly number[]): number[] {
  let min = Infinity;
  let max = -Infinity;
  for (const v of field) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const range = max - min || 1;
  return field.map((v) => (v - min) / range);
}

/** Value at the given quantile (0..1) of a *pre-sorted ascending* array. */
function quantile(sortedAsc: readonly number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  const clamped = Math.min(1, Math.max(0, q));
  const idx = Math.min(sortedAsc.length - 1, Math.floor(clamped * sortedAsc.length));
  return sortedAsc[idx] as number;
}

function pickWeighted(candidates: readonly TerrainWeight[], value01: number): TerrainId {
  const total = candidates.reduce((sum, c) => sum + c.weight, 0);
  let target = Math.min(value01, 0.999999) * total;
  for (const c of candidates) {
    if (target < c.weight) return c.id;
    target -= c.weight;
  }
  // Fractional error fallback: last candidate is always defined (tables are non-empty).
  return candidates[candidates.length - 1]!.id;
}

// ---------------------------------------------------------------------------
// World generation
// ---------------------------------------------------------------------------

const BLOBS_PER_TILE = 1 / 55;
const MIN_BLOBS = 8;
const MAX_BLOBS = 60;

/** Generates one plane's map. Deterministic: same rng state + planeDef + size => identical map. */
export function generateWorld(rng: Rng, planeDef: PlaneDef, size: MapSize): PlaneMap {
  const { width, height } = SIZE_DIMENSIONS[size];
  const numBlobs = Math.round(
    Math.min(MAX_BLOBS, Math.max(MIN_BLOBS, width * height * BLOBS_PER_TILE)),
  );

  const elevationRng = rng.fork(`mapgen:${planeDef.id}:elevation`);
  const biomeRng = rng.fork(`mapgen:${planeDef.id}:biome`);

  // Fraction of the map that ends up as land, itself seeded (so different
  // planes/seeds get varied coastlines) but always within [0.35, 0.55],
  // comfortably inside the required 20-80% overall bound.
  const targetLandFraction = 0.35 + elevationRng.next() * 0.2;

  const elevationField = generateBlobField(elevationRng, width, height, numBlobs);
  const biomeField = generateBlobField(biomeRng, width, height, numBlobs);

  const sortedElevation = elevationField.slice().sort((a, b) => a - b);
  const seaLevel = quantile(sortedElevation, 1 - targetLandFraction);

  const landElevations = elevationField.filter((e) => e > seaLevel).sort((a, b) => a - b);
  const hillLevel = quantile(landElevations, 0.65);
  const mountainLevel = quantile(landElevations, 0.9);

  const table = TERRAIN_TABLES[planeDef.id];
  const tiles: Tile[] = new Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = xyToIndex(x, y, width);
      const e = elevationField[idx] as number;

      if (e <= seaLevel) {
        tiles[idx] = { terrain: 'ocean', elevation: 0 };
        continue;
      }

      let tier: ElevationTier;
      let band: readonly TerrainWeight[];
      if (e <= hillLevel) {
        tier = 1;
        band = table.flat;
      } else if (e <= mountainLevel) {
        tier = 2;
        band = table.hill;
      } else {
        tier = 3;
        band = table.peak;
      }

      const terrain = pickWeighted(band, biomeField[idx] as number);
      tiles[idx] = { terrain, elevation: tier };
    }
  }

  // Shore pass: any ocean tile touching land becomes shore.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = xyToIndex(x, y, width);
      const tile = tiles[idx] as Tile;
      if (tile.terrain !== 'ocean') continue;
      for (const n of neighbors(x, y, width, height)) {
        const nIdx = xyToIndex(n.x, n.y, width);
        const nTile = tiles[nIdx] as Tile;
        if (nTile.terrain !== 'ocean') {
          tile.terrain = 'shore';
          break;
        }
      }
    }
  }

  return { plane: planeDef.id, width, height, tiles };
}

/**
 * Generates every plane's map from a single Rng. Each plane draws from a
 * substream keyed by its own id (see `generateWorld`), so planes are
 * generated independently of one another and of iteration order.
 */
export function generateAllPlanes(
  rng: Rng,
  planes: readonly PlaneDef[],
  size: MapSize,
): Record<PlaneId, PlaneMap> {
  const result = {} as Record<PlaneId, PlaneMap>;
  for (const planeDef of planes) {
    result[planeDef.id] = generateWorld(rng, planeDef, size);
  }
  return result;
}
