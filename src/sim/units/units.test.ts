import { describe, expect, it } from 'vitest';
import { findPath, moveUnit, moveCostAt, isPassable, MOVE_COSTS } from './units';
import { makeMap, setTerrain } from '../__fixtures__/content';
import type { UnitState } from '../types';
import type { TerrainId } from '../map/tiles';

const ALL_TERRAINS: TerrainId[] = [
  'ocean', 'shore', 'grassland', 'forest', 'hills', 'mountains', 'desert', 'swamp', 'tundra',
  'ashen-waste', 'bonefield', 'gloom-forest', 'radiant-plain', 'crystal-forest', 'aurora-peaks',
  'cloud-shoal', 'gilded-reef', 'sanctum-spire', 'bone-marsh', 'blood-fen', 'blackspire',
  'cinder-flat', 'magma-field', 'brimstone-spire', 'vine-tangle', 'mossmire', 'canopy-spire',
  'mirror-flat', 'prism-shard', 'starlit-void',
];

function makeUnit(x: number, y: number, moves: number): UnitState {
  return { id: 'unit-1', owner: 'player-0', defId: 'militia', plane: 'meridia', x, y, moves, hp: 4 };
}

describe('movement cost table', () => {
  it('covers every one of the 30 terrain ids', () => {
    for (const t of ALL_TERRAINS) expect(MOVE_COSTS[t]).toBeDefined();
    expect(Object.keys(MOVE_COSTS)).toHaveLength(30);
  });

  it('ocean and shore are impassable to land units; land is 1..3', () => {
    expect(isPassable(makeMap('meridia', 3, 3, 'ocean'), 1, 1)).toBe(false);
    expect(isPassable(makeMap('meridia', 3, 3, 'shore'), 1, 1)).toBe(false);
    for (const t of ALL_TERRAINS) {
      const c = MOVE_COSTS[t];
      if (t === 'ocean' || t === 'shore') expect(c).toBe(Infinity);
      else {
        expect(c).toBeGreaterThanOrEqual(1);
        expect(c).toBeLessThanOrEqual(3);
      }
    }
  });

  it('moveCostAt returns Infinity out of bounds', () => {
    expect(moveCostAt(makeMap('meridia', 3, 3), -1, 0)).toBe(Infinity);
  });
});

describe('findPath', () => {
  it('finds a straight diagonal path (diagonals cost same as orthogonals)', () => {
    const map = makeMap('meridia', 8, 8, 'grassland');
    const path = findPath(map, 0, 0, 3, 3);
    expect(path).not.toBeNull();
    // 3 diagonal steps: start + 3 tiles.
    expect(path).toHaveLength(4);
    expect(path![path!.length - 1]).toEqual({ x: 3, y: 3 });
  });

  it('routes around an impassable ocean wall', () => {
    const map = makeMap('meridia', 7, 7, 'grassland');
    // Vertical ocean wall at x=3 for y=0..5, gap at y=6.
    for (let y = 0; y <= 5; y++) setTerrain(map, 3, y, 'ocean');
    const path = findPath(map, 1, 3, 5, 3);
    expect(path).not.toBeNull();
    // The path must never step on an ocean tile.
    for (const p of path!) expect(map.tiles[p.y * map.width + p.x]!.terrain).not.toBe('ocean');
    // It must detour toward the gap (reach y=6 at some point).
    expect(path!.some((p) => p.y === 6)).toBe(true);
  });

  it('returns null for an isolated (walled-off) target', () => {
    const map = makeMap('meridia', 9, 9, 'grassland');
    // Surround (5,5) with ocean on all 8 neighbors -> unreachable island.
    const offs: [number, number][] = [[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]];
    for (const [dx, dy] of offs) setTerrain(map, 5 + dx, 5 + dy, 'ocean');
    expect(findPath(map, 1, 1, 5, 5)).toBeNull();
  });

  it('returns null when the target itself is impassable', () => {
    const map = makeMap('meridia', 6, 6, 'grassland');
    setTerrain(map, 4, 4, 'ocean');
    expect(findPath(map, 0, 0, 4, 4)).toBeNull();
  });

  it('is deterministic — identical requests give identical paths', () => {
    const map = makeMap('meridia', 10, 10, 'grassland');
    setTerrain(map, 5, 5, 'mountains');
    expect(findPath(map, 0, 0, 9, 9)).toEqual(findPath(map, 0, 0, 9, 9));
  });

  it('prefers cheaper terrain (avoids costly mountains when a flat detour exists)', () => {
    const map = makeMap('meridia', 5, 3, 'grassland');
    setTerrain(map, 2, 1, 'mountains'); // cost 3 in the middle
    const path = findPath(map, 0, 1, 4, 1);
    expect(path).not.toBeNull();
    // Cheapest route steps around the mountain rather than through it.
    expect(path!.some((p) => p.x === 2 && p.y === 1)).toBe(false);
  });
});

describe('moveUnit', () => {
  it('exhausts movement points and stops partway', () => {
    const map = makeMap('meridia', 10, 1, 'grassland'); // all cost 1
    const unit = makeUnit(0, 0, 1);
    const remaining = moveUnit(map, unit, 5, 0);
    expect(unit.x).toBe(1); // moved exactly one tile (1 point spent)
    expect(unit.moves).toBe(0);
    expect(remaining).not.toBeNull();
    expect(remaining!.length).toBeGreaterThan(0); // more path left for later turns
  });

  it('spends multiple points in one turn', () => {
    const map = makeMap('meridia', 10, 1, 'grassland');
    const unit = makeUnit(0, 0, 3);
    moveUnit(map, unit, 5, 0);
    expect(unit.x).toBe(3);
    expect(unit.moves).toBe(0);
  });

  it('may enter a single expensive tile with any movement left (MoM rule)', () => {
    const map = makeMap('meridia', 4, 1, 'grassland');
    setTerrain(map, 1, 0, 'mountains'); // cost 3
    const unit = makeUnit(0, 0, 1); // only 1 point
    moveUnit(map, unit, 3, 0);
    expect(unit.x).toBe(1); // entered the mountain despite cost 3
    expect(unit.moves).toBe(0);
  });

  it('returns null and does not move when there is no path', () => {
    const map = makeMap('meridia', 5, 5, 'grassland');
    setTerrain(map, 2, 2, 'ocean');
    const unit = makeUnit(0, 0, 5);
    expect(moveUnit(map, unit, 2, 2)).toBeNull();
    expect(unit.x).toBe(0);
    expect(unit.y).toBe(0);
    expect(unit.moves).toBe(5);
  });
});
