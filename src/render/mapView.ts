/**
 * The Pixi map view: draws one plane of a GameState (terrain, cities, units,
 * labels) and handles pan / zoom / click. Pure presentation — it reads state
 * and never mutates it; all interaction is surfaced through callbacks the UI
 * turns into sim commands.
 */

import {
  Application,
  Container,
  Graphics,
  Sprite,
  Text,
  Texture,
  TilingSprite,
  type FederatedPointerEvent,
  type FederatedWheelEvent,
} from 'pixi.js';

import type { GameState } from '@sim/core/state';
import type { PlaneId, UnitDef } from '@sim/types';
import type { PlaneMap } from '@sim/map/tiles';

import type { SpriteBank } from './sprites';
import { TERRAIN_SPRITE_MAP, battleSpriteFor, citySpriteFor } from './spriteMaps';

/** Minimal lair shape the map view needs (matches src/ui/battleTypes.ts). */
export interface MapLair {
  id: string;
  plane: PlaneId;
  x: number;
  y: number;
  cleared: boolean;
}

const TILE = 24;
const ZOOM_STEPS = [1, 2, 3] as const;

export interface Selection {
  kind: 'city' | 'unit';
  id: string;
}

export type TileClickHandler = (tileX: number, tileY: number) => void;

export class MapView {
  private readonly app: Application;
  private readonly bank: SpriteBank;
  private readonly units: Record<string, UnitDef>;

  /** Full-viewport sea backdrop so off-map area reads as deep ocean. */
  private readonly backdrop: TilingSprite;
  /** Scaled world container: terrain + entities live here. */
  private readonly world = new Container();
  private readonly terrainLayer = new Container();
  private readonly highlight = new Graphics();
  private readonly entityLayer = new Container();
  /** Unscaled overlay for crisp text labels. */
  private readonly labelLayer = new Container();

  private map: PlaneMap | null = null;
  private cameraX = 0; // tile coord mapped to screen centre
  private cameraY = 0;
  private zoom = 2;

  private labelAnchors: { text: Text; tx: number; ty: number }[] = [];

  onTileClick: TileClickHandler = () => {};

  constructor(app: Application, bank: SpriteBank, units: Record<string, UnitDef>) {
    this.app = app;
    this.bank = bank;
    this.units = units;

    const ocean = bank.terrain.textures['ocean'] ?? Texture.WHITE;
    this.backdrop = new TilingSprite({ texture: ocean, width: 100, height: 100 });

    this.world.addChild(this.terrainLayer);
    this.world.addChild(this.highlight);
    this.world.addChild(this.entityLayer);
    app.stage.addChild(this.backdrop);
    app.stage.addChild(this.world);
    app.stage.addChild(this.labelLayer);

    this.installInput();
    window.addEventListener('resize', () => this.applyCamera());
  }

  // --- Terrain -------------------------------------------------------------

  /** (Re)builds the terrain layer for a plane. Terrain is static per plane. */
  setPlane(map: PlaneMap): void {
    this.map = map;
    this.terrainLayer.removeChildren();
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = map.tiles[y * map.width + x];
        if (!tile) continue;
        const drawn = TERRAIN_SPRITE_MAP[tile.terrain];
        const tex = this.bank.terrain.textures[drawn] ?? Texture.WHITE;
        const s = new Sprite(tex);
        s.x = x * TILE;
        s.y = y * TILE;
        this.terrainLayer.addChild(s);
      }
    }
  }

  // --- Entities ------------------------------------------------------------

  /** Rebuilds cities, units, lairs, labels, and the selection highlight. */
  syncEntities(
    state: GameState,
    plane: PlaneId,
    selected: Selection | null,
    lairs: MapLair[] = [],
    selectedLairId: string | null = null,
  ): void {
    this.entityLayer.removeChildren();
    this.labelLayer.removeChildren();
    this.labelAnchors = [];
    this.highlight.clear();

    // Lairs (drawn first, under cities/units).
    for (const lair of lairs) {
      if (lair.plane !== plane) continue;
      const tex = this.bank.lair.textures['lair'] ?? Texture.WHITE;
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.5);
      s.x = lair.x * TILE + TILE / 2;
      s.y = lair.y * TILE + TILE / 2;
      if (lair.cleared) {
        // Cleared lairs read as a faded ruin rather than vanishing.
        s.alpha = 0.35;
        s.tint = 0x8a8a8a;
      }
      this.entityLayer.addChild(s);
      if (selectedLairId && lair.id === selectedLairId) {
        this.drawHighlight(lair.x, lair.y, 0xff9a6a);
      }
    }

    // Cities (drawn under units so a garrison stays visible).
    for (const city of state.cities) {
      if (city.plane !== plane) continue;
      const tex = this.bank.cities.textures[citySpriteFor(city.population)] ?? Texture.WHITE;
      const s = new Sprite(tex);
      s.x = city.x * TILE;
      s.y = city.y * TILE;
      this.entityLayer.addChild(s);

      const label = new Text({
        text: city.name,
        style: {
          fontFamily: 'monospace',
          fontSize: 12,
          fontWeight: 'bold',
          fill: '#f2d58f',
          stroke: { color: '#1a1208', width: 4, join: 'round' },
          align: 'center',
        },
      });
      label.anchor.set(0.5, 1);
      this.labelLayer.addChild(label);
      this.labelAnchors.push({ text: label, tx: city.x + 0.5, ty: city.y - 0.15 });

      if (selected && selected.kind === 'city' && selected.id === city.id) {
        this.drawHighlight(city.x, city.y, 0x8ff0c0);
      }
    }

    // Units (on top).
    for (const unit of state.units) {
      if (unit.plane !== plane) continue;
      const def = this.units[unit.defId];
      const drawn = def ? battleSpriteFor(def) : 'swordsman';
      const tex = this.bank.battle.textures[drawn] ?? Texture.WHITE;
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.5);
      s.x = unit.x * TILE + TILE / 2;
      s.y = unit.y * TILE + TILE / 2 + 3;
      this.entityLayer.addChild(s);

      if (selected && selected.kind === 'unit' && selected.id === unit.id) {
        this.drawHighlight(unit.x, unit.y, 0xffe27a);
      }
    }

    this.applyCamera();
  }

  private drawHighlight(tx: number, ty: number, color: number): void {
    this.highlight
      .rect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2)
      .stroke({ color, width: 2, alpha: 0.95 });
  }

  // --- Camera --------------------------------------------------------------

  centerOn(tileX: number, tileY: number): void {
    this.cameraX = tileX + 0.5;
    this.cameraY = tileY + 0.5;
    this.applyCamera();
  }

  panTiles(dx: number, dy: number): void {
    this.cameraX += dx;
    this.cameraY += dy;
    this.applyCamera();
  }

  setZoom(z: number): void {
    const clamped = ZOOM_STEPS.reduce((best, s) =>
      Math.abs(s - z) < Math.abs(best - z) ? s : best, ZOOM_STEPS[0]);
    this.zoom = clamped;
    this.applyCamera();
  }

  zoomBy(dir: number): void {
    const i = ZOOM_STEPS.indexOf(this.zoom as (typeof ZOOM_STEPS)[number]);
    const ni = Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + (dir > 0 ? 1 : -1)));
    this.zoom = ZOOM_STEPS[ni] ?? this.zoom;
    this.applyCamera();
  }

  private applyCamera(): void {
    if (this.map) {
      // Keep the camera inside the map with a little slack.
      this.cameraX = Math.max(-2, Math.min(this.map.width + 2, this.cameraX));
      this.cameraY = Math.max(-2, Math.min(this.map.height + 2, this.cameraY));
    }
    const sw = this.app.renderer.width;
    const sh = this.app.renderer.height;
    // Integer origin keeps pixel art crisp.
    const originX = Math.round(sw / 2 - this.cameraX * TILE * this.zoom);
    const originY = Math.round(sh / 2 - this.cameraY * TILE * this.zoom);
    this.world.scale.set(this.zoom);
    this.world.position.set(originX, originY);

    // Sea backdrop: fill the viewport and align its tile grid with the map's
    // ocean tiles so off-map area looks like the ocean simply continuing.
    this.backdrop.width = sw;
    this.backdrop.height = sh;
    this.backdrop.tileScale.set(this.zoom);
    this.backdrop.tilePosition.set(originX % (TILE * this.zoom), originY % (TILE * this.zoom));

    this.updateLabels(originX, originY);
  }

  private updateLabels(originX: number, originY: number): void {
    for (const a of this.labelAnchors) {
      a.text.x = Math.round(originX + a.tx * TILE * this.zoom);
      a.text.y = Math.round(originY + a.ty * TILE * this.zoom);
    }
  }

  private screenToTile(sx: number, sy: number): { x: number; y: number } {
    const originX = this.world.position.x;
    const originY = this.world.position.y;
    return {
      x: Math.floor((sx - originX) / (TILE * this.zoom)),
      y: Math.floor((sy - originY) / (TILE * this.zoom)),
    };
  }

  // --- Input ---------------------------------------------------------------

  private installInput(): void {
    const stage = this.app.stage;
    stage.eventMode = 'static';
    stage.hitArea = { contains: () => true } as { contains: () => boolean };

    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let lastY = 0;

    stage.on('pointerdown', (e: FederatedPointerEvent) => {
      dragging = true;
      moved = 0;
      lastX = e.globalX;
      lastY = e.globalY;
    });

    stage.on('pointermove', (e: FederatedPointerEvent) => {
      if (!dragging) return;
      const dx = e.globalX - lastX;
      const dy = e.globalY - lastY;
      moved += Math.abs(dx) + Math.abs(dy);
      lastX = e.globalX;
      lastY = e.globalY;
      this.cameraX -= dx / (TILE * this.zoom);
      this.cameraY -= dy / (TILE * this.zoom);
      this.applyCamera();
    });

    const endDrag = (e: FederatedPointerEvent) => {
      if (dragging && moved < 6) {
        const t = this.screenToTile(e.globalX, e.globalY);
        this.onTileClick(t.x, t.y);
      }
      dragging = false;
    };
    stage.on('pointerup', endDrag);
    stage.on('pointerupoutside', () => {
      dragging = false;
    });

    stage.on('wheel', (e: FederatedWheelEvent) => {
      this.zoomBy(e.deltaY < 0 ? 1 : -1);
    });
  }
}
