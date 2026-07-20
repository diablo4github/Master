import { describe, expect, it } from 'vitest';

import { MOVE_COSTS } from '@sim/units/units';
import { UNITS } from '@data/units';
import type { UnitDef } from '@sim/types';
import {
  TERRAIN_SPRITE_MAP,
  battleSpriteFor,
  battleGroundColor,
  citySpriteFor,
} from './spriteMaps';

import terrainManifest from '../../assets/terrain.json';
import battleManifest from '../../assets/battle.json';
import citiesManifest from '../../assets/cities.json';

interface Manifest {
  entries: { id: string }[];
}
function ids(m: unknown): Set<string> {
  return new Set((m as Manifest).entries.map((e) => e.id));
}

const terrainDrawn = ids(terrainManifest);
const battleDrawn = ids(battleManifest);
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

  it('battleGroundColor returns a colour for every terrain', () => {
    for (const id of ALL_TERRAIN_IDS) {
      const c = battleGroundColor(id as keyof typeof TERRAIN_SPRITE_MAP);
      expect(typeof c, id).toBe('number');
      expect(c, id).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('battleSpriteFor', () => {
  it('resolves EVERY unit in the roster to a drawn battle sprite (totality)', () => {
    const allIds = Object.keys(UNITS);
    expect(allIds.length).toBeGreaterThan(140); // ~152 units
    for (const id of allIds) {
      const def = UNITS[id] as UnitDef;
      const sprite = battleSpriteFor(def);
      expect(battleDrawn.has(sprite), `${id} -> ${sprite}`).toBe(true);
    }
  });

  it('picks the identity-defining archetype for representative units', () => {
    const pick = (id: string) => battleSpriteFor(UNITS[id] as UnitDef);
    // undead ability wins first.
    expect(pick('skeleton')).toBe('undead');
    expect(pick('zombie')).toBe('undead');
    // Life-school summon → celestial.
    expect(pick('angel')).toBe('celestial');
    // Lone breath-weapon creature → dragon.
    expect(pick('elder-dragon')).toBe('dragon');
    expect(pick('fire-drake')).toBe('dragon');
    // Reach-2 polearm → spearman.
    expect(pick('human-spearman')).toBe('spearman');
    // Rule chosen for the horse archer: role cavalry wins → cavalry.
    expect(pick('nomad-horse-archer')).toBe('cavalry');
    // Flyer.
    expect(pick('wyvern')).toBe('flyer');
    // Foot archer.
    expect(pick('human-archer')).toBe('archer');
    // Generic line infantry falls through to swordsman.
    expect(pick('human-swordsman')).toBe('swordsman');
    // Named beast/pack overrides.
    expect(pick('giant-spiders')).toBe('swarm');
    expect(pick('great-boar')).toBe('beast');
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
