// 16x16 map tiles. Every tile is a subtle two-tone ordered dither (for
// texture without noise) plus a small, centered feature that reads at 1x.
// Dithers are keyed on absolute in-tile coordinates, so the texture stays
// continuous when tiles are placed edge-to-edge — no border vignettes.
import type { Sprite } from '../sprite';
import { ditherRect, fillRect, makeGrid, plot, setPixel, toRows, type Grid } from '../pixels';
import { DEATH, EARTH, FOREST, GRASS, LIFE, SAND, SNOW, STONE, SWAMP, WATER } from '../colors';

const SIZE = 16;

function tile(id: string, palette: Record<string, string>, grid: Grid): Sprite {
  return { id, size: SIZE, palette, rows: toRows(grid) };
}

function grassland(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'l', 0.32);
  plot(g, [[3, 3], [11, 4], [6, 9], [13, 11], [2, 12], [9, 13]], 'd');
  return tile('grassland', { m: GRASS.mid, l: GRASS.light, d: GRASS.dark }, g);
}

function forest(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'f', 'd', 0.3);
  fillRect(g, 7, 12, 8, 15, 't');
  fillRect(g, 3, 2, 10, 7, 'c');
  fillRect(g, 2, 3, 11, 6, 'c');
  fillRect(g, 3, 2, 6, 3, 'h');
  fillRect(g, 9, 6, 11, 7, 's');
  return tile('forest', { f: GRASS.dark, d: GRASS.shadow, t: FOREST.trunk, c: FOREST.canopyMid, h: FOREST.canopyLight, s: FOREST.canopyDark }, g);
}

function hills(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'g', 'd', 0.25);
  fillRect(g, 1, 9, 7, 15, 'b');
  fillRect(g, 2, 7, 6, 9, 'b');
  fillRect(g, 3, 6, 5, 7, 'b');
  fillRect(g, 2, 7, 4, 9, 'h');
  fillRect(g, 5, 12, 7, 15, 's');
  fillRect(g, 9, 11, 14, 15, 'b');
  fillRect(g, 10, 9, 13, 11, 'b');
  fillRect(g, 10, 9, 11, 10, 'h');
  fillRect(g, 12, 13, 14, 15, 's');
  return tile('hills', { g: EARTH.mid, d: EARTH.dark, b: EARTH.light, h: SAND.light, s: EARTH.shadow }, g);
}

function mountains(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'g', 'gd', 0.28);
  for (let y = 2; y <= 15; y++) {
    const half = Math.min(7, Math.round((y - 2) * 0.55));
    fillRect(g, 8 - half, y, 8 + half, y, 'r');
    setPixel(g, 8 - half, y, 'h');
    setPixel(g, 8 + half, y, 'd');
  }
  fillRect(g, 6, 2, 10, 4, 'sn');
  setPixel(g, 5, 4, 'sn');
  setPixel(g, 11, 4, 'sn');
  return tile('mountains', { g: STONE.mid, gd: STONE.dark, r: STONE.mid, h: STONE.light, d: STONE.shadow, sn: SNOW.white }, g);
}

function ocean(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'l', 0.35);
  plot(g, [[2, 5], [3, 5], [10, 9], [11, 9], [6, 13], [7, 13]], 'd');
  for (let y = 2; y < 16; y += 4) {
    for (let x = 0; x < 16; x += 4) {
      setPixel(g, x, y, 'w');
      setPixel(g, x + 1, y, 'w');
    }
  }
  return tile('ocean', { m: WATER.mid, l: WATER.light, d: WATER.dark, w: WATER.foam }, g);
}

function shore(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 6, 'wm', 'wl', 0.35);
  ditherRect(g, 0, 9, 15, 15, 'sm', 'sl', 0.3);
  ditherRect(g, 0, 7, 15, 8, 'wl', 'sl', 0.5);
  for (let x = 0; x < 16; x += 4) {
    setPixel(g, x, 7, 'f');
    setPixel(g, x + 2, 8, 'f');
  }
  return tile('shore', { wm: WATER.mid, wl: WATER.light, sm: SAND.mid, sl: SAND.light, f: WATER.foam }, g);
}

function desert(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'd', 0.28);
  fillRect(g, 1, 2, 6, 4, 'l');
  fillRect(g, 2, 1, 5, 1, 'l');
  plot(g, [[9, 9], [10, 10], [10, 11], [11, 12], [12, 12], [13, 13]], 'c');
  return tile('desert', { m: SAND.mid, d: SAND.dark, l: SAND.light, c: SAND.shadow }, g);
}

function swamp(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'd', 0.3);
  fillRect(g, 2, 9, 6, 12, 'p');
  fillRect(g, 9, 3, 13, 6, 'p');
  plot(g, [[3, 8], [4, 8], [10, 7], [11, 2], [5, 13], [12, 7]], 's');
  return tile('swamp', { m: SWAMP.mid, d: SWAMP.dark, p: SWAMP.muck, s: SWAMP.sick }, g);
}

function ashenWaste(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'd', 0.3);
  plot(g, [[4, 4], [11, 6], [7, 10], [13, 12], [2, 13]], 'e');
  plot(g, [[5, 5], [12, 7]], 'el');
  return tile('ashen-waste', { m: DEATH.ashMid, d: DEATH.ashDark, e: DEATH.ember, el: DEATH.emberLight }, g);
}

function bonefield(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'd', 0.25);
  fillRect(g, 3, 8, 3, 13, 'b');
  fillRect(g, 4, 8, 8, 9, 'b');
  fillRect(g, 4, 11, 7, 11, 'b');
  fillRect(g, 10, 3, 13, 5, 'b');
  setPixel(g, 11, 4, 'bl');
  setPixel(g, 12, 4, 'sh');
  return tile('bonefield', { m: DEATH.boneWhite, d: DEATH.boneShadow, b: DEATH.boneBright, bl: DEATH.boneBright, sh: DEATH.ashDark }, g);
}

function gloomForest(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'd', 0.3);
  plot(g, [[7, 15], [7, 14], [8, 13], [7, 12], [8, 11], [7, 10], [6, 9]], 't');
  fillRect(g, 3, 3, 10, 7, 'c');
  fillRect(g, 2, 4, 11, 6, 'c');
  plot(g, [[4, 4], [9, 4], [5, 3]], 'h');
  return tile('gloom-forest', { m: SWAMP.dark, d: DEATH.voidBlack, t: DEATH.voidBlack, c: DEATH.purple, h: DEATH.purpleLight }, g);
}

function radiantPlain(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'l', 0.35);
  plot(g, [[3, 3], [11, 5], [6, 9], [13, 11], [2, 12], [9, 7]], 'sp');
  return tile('radiant-plain', { m: LIFE.green, l: LIFE.greenLight, sp: LIFE.gold }, g);
}

function crystalForest(): Sprite {
  const g = makeGrid(SIZE);
  ditherRect(g, 0, 0, 15, 15, 'm', 'l', 0.3);
  fillRect(g, 5, 9, 6, 14, 'c');
  fillRect(g, 8, 7, 9, 14, 'c');
  fillRect(g, 11, 10, 12, 14, 'c');
  plot(g, [[5, 9], [8, 7], [11, 10]], 'h');
  fillRect(g, 5, 13, 12, 14, 'sd');
  return tile('crystal-forest', { m: LIFE.white, l: LIFE.crystalBlueLight, c: LIFE.crystalBlue, h: LIFE.crystalBlueLight, sd: LIFE.crystalBlueDark }, g);
}

export const TERRAIN_SPRITES: Sprite[] = [
  grassland(),
  forest(),
  hills(),
  mountains(),
  ocean(),
  shore(),
  desert(),
  swamp(),
  ashenWaste(),
  bonefield(),
  gloomForest(),
  radiantPlain(),
  crystalForest(),
];
