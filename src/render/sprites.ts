/**
 * Spritesheet loading and slicing.
 *
 * Each spritesheet is a PNG plus a JSON manifest (cellSize + per-id x/y). We
 * load the PNG as a single Pixi texture source (nearest-neighbour, no mipmaps
 * — crisp pixel art), then mint one sub-Texture per manifest entry sharing
 * that source. All coordinates come straight from the committed manifests.
 */

import { Assets, Rectangle, Texture, TextureSource } from 'pixi.js';

import terrainUrl from '../../assets/terrain.png';
import unitsUrl from '../../assets/units.png';
import citiesUrl from '../../assets/cities.png';
import buildingsUrl from '../../assets/buildings.png';
import battleUrl from '../../assets/battle.png';
import lairUrl from '../../assets/lair.png';

import terrainManifest from '../../assets/terrain.json';
import unitsManifest from '../../assets/units.json';
import citiesManifest from '../../assets/cities.json';
import buildingsManifest from '../../assets/buildings.json';
import battleManifest from '../../assets/battle.json';
import lairManifest from '../../assets/lair.json';

interface ManifestEntry {
  id: string;
  x: number;
  y: number;
}
interface Manifest {
  cellSize: number;
  columns: number;
  entries: ManifestEntry[];
}

/** A loaded sheet: cell size plus id → sub-texture. */
export interface Sheet {
  cellSize: number;
  textures: Record<string, Texture>;
}

async function loadSheet(url: string, manifest: Manifest): Promise<Sheet> {
  const source = (await Assets.load(url)) as Texture;
  // Crisp pixel art: nearest sampling, no smoothing.
  source.source.scaleMode = 'nearest';
  const base: TextureSource = source.source;
  const textures: Record<string, Texture> = {};
  const { cellSize } = manifest;
  for (const entry of manifest.entries) {
    textures[entry.id] = new Texture({
      source: base,
      frame: new Rectangle(entry.x, entry.y, cellSize, cellSize),
    });
  }
  return { cellSize, textures };
}

export interface SpriteBank {
  terrain: Sheet;
  units: Sheet;
  cities: Sheet;
  buildings: Sheet;
  /** 14 combat archetypes (16px) — used by battle viewer and strategic map. */
  battle: Sheet;
  /** Lair marker (24px). */
  lair: Sheet;
}

let bankPromise: Promise<SpriteBank> | null = null;

/** Loads (once) and returns every spritesheet. */
export function loadSprites(): Promise<SpriteBank> {
  if (!bankPromise) {
    // Make nearest the default for any texture created before per-source setup.
    TextureSource.defaultOptions.scaleMode = 'nearest';
    bankPromise = (async () => {
      const [terrain, units, cities, buildings, battle, lair] = await Promise.all([
        loadSheet(terrainUrl, terrainManifest as Manifest),
        loadSheet(unitsUrl, unitsManifest as Manifest),
        loadSheet(citiesUrl, citiesManifest as Manifest),
        loadSheet(buildingsUrl, buildingsManifest as Manifest),
        loadSheet(battleUrl, battleManifest as Manifest),
        loadSheet(lairUrl, lairManifest as Manifest),
      ]);
      return { terrain, units, cities, buildings, battle, lair };
    })();
  }
  return bankPromise;
}
