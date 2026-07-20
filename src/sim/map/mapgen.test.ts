import { describe, expect, it } from 'vitest';
import { createRng } from '../core/rng';
import { generateAllPlanes, generateWorld, legalTerrainsFor, type MapSize } from './mapgen';
import type { PlaneDef } from '../types';

// Minimal PlaneDef literals constructed inline — src/data is off-limits
// (other agents are writing it concurrently), so the sim's own tests must
// not depend on it.
const MERIDIA: PlaneDef = {
  id: 'meridia',
  name: 'Meridia',
  kind: 'world',
  thrivingSchools: ['chaos', 'nature', 'sorcery'],
  description: 'The normal world.',
};

const UMBRA: PlaneDef = {
  id: 'umbra',
  name: 'Umbra',
  kind: 'world',
  thrivingSchools: ['death'],
  description: 'The dark world.',
};

const LUMINA: PlaneDef = {
  id: 'lumina',
  name: 'Lumina',
  kind: 'world',
  thrivingSchools: ['life'],
  description: 'The light world.',
};

const EMPYREAN: PlaneDef = {
  id: 'empyrean',
  name: 'The Empyrean',
  kind: 'dimension',
  school: 'life',
  thrivingSchools: ['life'],
  description: 'Life dimension.',
};

const CHARNEL_DEEP: PlaneDef = {
  id: 'charnel-deep',
  name: 'The Charnel Deep',
  kind: 'dimension',
  school: 'death',
  thrivingSchools: ['death'],
  description: 'Death dimension.',
};

const MAELSTROM: PlaneDef = {
  id: 'maelstrom',
  name: 'The Maelstrom',
  kind: 'dimension',
  school: 'chaos',
  thrivingSchools: ['chaos'],
  description: 'Chaos dimension.',
};

const WILDROOT: PlaneDef = {
  id: 'wildroot',
  name: 'The Wildroot',
  kind: 'dimension',
  school: 'nature',
  thrivingSchools: ['nature'],
  description: 'Nature dimension.',
};

const AETHER: PlaneDef = {
  id: 'aether',
  name: 'The Aether',
  kind: 'dimension',
  school: 'sorcery',
  thrivingSchools: ['sorcery'],
  description: 'Sorcery dimension.',
};

const ALL_PLANES: PlaneDef[] = [
  MERIDIA,
  UMBRA,
  LUMINA,
  EMPYREAN,
  CHARNEL_DEEP,
  MAELSTROM,
  WILDROOT,
  AETHER,
];

describe('generateWorld determinism', () => {
  it('same seed + same planeDef produces a deep-equal map', () => {
    const mapA = generateWorld(createRng(555), MERIDIA, 'medium');
    const mapB = generateWorld(createRng(555), MERIDIA, 'medium');
    expect(mapA).toEqual(mapB);
  });

  it('different seeds produce different maps', () => {
    const mapA = generateWorld(createRng(1), MERIDIA, 'medium');
    const mapB = generateWorld(createRng(2), MERIDIA, 'medium');
    expect(mapA).not.toEqual(mapB);
  });

  it('has the expected shape: width * height tiles, all with plane id set', () => {
    const map = generateWorld(createRng(10), MERIDIA, 'medium');
    expect(map.plane).toBe('meridia');
    expect(map.tiles).toHaveLength(map.width * map.height);
  });
});

describe('generateWorld terrain legality', () => {
  it.each(ALL_PLANES)('every tile terrain is legal for $id', (planeDef) => {
    const map = generateWorld(createRng(2026), planeDef, 'medium');
    const legal = legalTerrainsFor(planeDef.id);
    for (const tile of map.tiles) {
      expect(legal.has(tile.terrain)).toBe(true);
    }
  });
});

describe('generateWorld land/water ratio', () => {
  it.each(ALL_PLANES)('$id land fraction is within 20-80%', (planeDef) => {
    const map = generateWorld(createRng(31415), planeDef, 'medium');
    const landCount = map.tiles.filter((t) => t.terrain !== 'ocean' && t.terrain !== 'shore').length;
    const fraction = landCount / map.tiles.length;
    expect(fraction).toBeGreaterThan(0.2);
    expect(fraction).toBeLessThan(0.8);
  });
});

describe('generateWorld across all map sizes', () => {
  const sizes: MapSize[] = ['small', 'medium', 'large', 'huge'];
  it.each(sizes)('generates %s without error', (size) => {
    const map = generateWorld(createRng(1), MERIDIA, size);
    expect(map.tiles.length).toBeGreaterThan(0);
    expect(map.tiles).toHaveLength(map.width * map.height);
  });
});

describe('generateAllPlanes', () => {
  it('generates all 8 planes at medium size without error', () => {
    const maps = generateAllPlanes(createRng(2026), ALL_PLANES, 'medium');
    for (const planeDef of ALL_PLANES) {
      const map = maps[planeDef.id];
      expect(map).toBeDefined();
      expect(map.plane).toBe(planeDef.id);
      expect(map.tiles).toHaveLength(map.width * map.height);
    }
    expect(Object.keys(maps)).toHaveLength(8);
  });

  it('is deterministic for a fixed seed and plane list', () => {
    const mapsA = generateAllPlanes(createRng(77), ALL_PLANES, 'medium');
    const mapsB = generateAllPlanes(createRng(77), ALL_PLANES, 'medium');
    expect(mapsA).toEqual(mapsB);
  });

  it('generating one plane does not perturb another (fork independence)', () => {
    // Generating just Meridia from a fresh rng...
    const meridiaAlone = generateWorld(createRng(2026), MERIDIA, 'medium');
    // ...should match Meridia generated as part of the full multi-plane batch,
    // since each plane's substream is keyed by its own id, not by draw order.
    const allMaps = generateAllPlanes(createRng(2026), ALL_PLANES, 'medium');
    expect(allMaps.meridia).toEqual(meridiaAlone);
  });
});
