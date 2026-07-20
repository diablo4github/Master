import { describe, expect, it } from 'vitest';

import { MOVE_COSTS } from '@sim/units/units';
import { UNITS } from '@data/units';
import {
  TERRAIN_SPRITE_MAP,
  UNIT_SPRITE_MAP,
  citySpriteFor,
} from './spriteMaps';

import terrainManifest from '../../assets/terrain.json';
import unitsManifest from '../../assets/units.json';
import citiesManifest from '../../assets/cities.json';

interface Manifest {
  entries: { id: string }[];
}
function ids(m: unknown): Set<string> {
  return new Set((m as Manifest).entries.map((e) => e.id));
}

const terrainDrawn = ids(terrainManifest);
const unitDrawn = ids(unitsManifest);
const cityDrawn = ids(citiesManifest);

// MOVE_COSTS is a Record<TerrainId, number> spanning all 30 sim terrain ids,
// so its keys are the authoritative TerrainId list.
const ALL_TERRAIN_IDS = Object.keys(MOVE_COSTS);

describe('TERRAIN_SPRITE_MAP', () => {
  it('covers every one of the 30 sim TerrainIds', () => {
    expect(ALL_TERRAIN_IDS.length).toBe(30);
    for (const id of ALL_TERRAIN_IDS) {
      expect(TERRAIN_SPRITE_MAP[id as keyof typeof TERRAIN_SPRITE_MAP], id).toBeDefined();
    }
  });

  it('has no keys beyond the sim TerrainIds', () => {
    for (const key of Object.keys(TERRAIN_SPRITE_MAP)) {
      expect(ALL_TERRAIN_IDS, `stray key ${key}`).toContain(key);
    }
  });

  it('maps every terrain to a real drawn tile in the manifest', () => {
    for (const id of ALL_TERRAIN_IDS) {
      const drawn = TERRAIN_SPRITE_MAP[id as keyof typeof TERRAIN_SPRITE_MAP];
      expect(terrainDrawn.has(drawn), `${id} -> ${drawn}`).toBe(true);
    }
  });
});

describe('UNIT_SPRITE_MAP', () => {
  it('covers every unit def in the roster', () => {
    for (const id of Object.keys(UNITS)) {
      expect(UNIT_SPRITE_MAP[id], id).toBeDefined();
    }
  });

  it('maps every unit to a real drawn sprite in the manifest', () => {
    for (const id of Object.keys(UNIT_SPRITE_MAP)) {
      const drawn = UNIT_SPRITE_MAP[id];
      expect(unitDrawn.has(drawn as string), `${id} -> ${drawn}`).toBe(true);
    }
  });
});

describe('citySpriteFor', () => {
  it('picks village / town / large by population', () => {
    expect(citySpriteFor(1)).toBe('city-village');
    expect(citySpriteFor(4)).toBe('city-village');
    expect(citySpriteFor(5)).toBe('city-town');
    expect(citySpriteFor(8)).toBe('city-town');
    expect(citySpriteFor(9)).toBe('city-large');
    expect(citySpriteFor(20)).toBe('city-large');
  });

  it('only returns ids present in the cities manifest', () => {
    for (const pop of [1, 5, 9, 15]) {
      expect(cityDrawn.has(citySpriteFor(pop))).toBe(true);
    }
  });
});
