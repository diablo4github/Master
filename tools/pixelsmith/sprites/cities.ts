// 24x24 city sprites — sit on top of a terrain tile, so unlike terrain
// tiles these do NOT fill every pixel: outside the settlement's footprint
// stays transparent ('.') so the terrain underneath shows through. Three
// tiers (village -> town -> large) read as a size/material progression:
// wood-and-thatch huts, a stone-walled hall among more huts with a road,
// then a full stone curtain wall with a keep behind it. Race-neutral earthy
// palette drawn from colors.ts families. Light source is consistently
// top-left, matching every other sprite set in the pipeline.
import type { Sprite } from '../sprite';
import { compileSprite, fillRect, makeGrid, plot, setPixel, shadeDisc, type Grid } from '../pixels';
import { EARTH, OUTLINE, SAND, STONE } from '../colors';

const SIZE = 24;

function city(id: string, colors: Record<string, string>, grid: Grid): Sprite {
  return compileSprite(id, SIZE, grid, colors);
}

/** A gable roof: a triangle growing linearly from `apexX,apexY` down to a
 * base `baseHalf` pixels wide either side, lit-left/shadow-right slopes —
 * the same idiom as terrain.ts's drawPeak and buildings.ts's roofTriangle,
 * reused here at hut scale. */
function gableRoof(
  grid: Grid,
  apexX: number,
  apexY: number,
  baseHalf: number,
  height: number,
  chBody: string,
  chLight: string,
  chShadow: string,
): void {
  for (let i = 0; i <= height; i++) {
    const y = apexY + i;
    const half = Math.max(0, Math.round((i / height) * baseHalf));
    fillRect(grid, apexX - half, y, apexX + half, y, chBody);
    setPixel(grid, apexX - half, y, chLight);
    setPixel(grid, apexX + half, y, chShadow);
  }
}

function village(): Sprite {
  const g = makeGrid(SIZE);

  // Trodden dirt clearing binding the huts together — packed earth, darker
  // than surrounding grass so it reads clearly against any terrain tile.
  shadeDisc(g, 11, 16, 7, 'g', 'gl', 'gs');
  shadeDisc(g, 18, 18, 4, 'g', 'gl', 'gs');
  shadeDisc(g, 5, 17, 4, 'g', 'gl', 'gs');
  plot(g, [[9, 21], [14, 19], [21, 21], [3, 20]], 'gs');

  // Hut A — large, lower-left.
  fillRect(g, 2, 15, 8, 20, 'w');
  fillRect(g, 2, 15, 2, 20, 'wl');
  fillRect(g, 8, 16, 8, 20, 'wd');
  gableRoof(g, 5, 9, 4, 6, 'th', 'thl', 'thd');
  fillRect(g, 4, 18, 5, 20, 'dr');

  // Hut B — medium, upper-right.
  fillRect(g, 14, 10, 19, 15, 'w');
  fillRect(g, 14, 10, 14, 15, 'wl');
  fillRect(g, 19, 11, 19, 15, 'wd');
  gableRoof(g, 16, 4, 3, 6, 'th', 'thl', 'thd');
  fillRect(g, 16, 13, 17, 15, 'dr');

  // Hut C — small, right, lower.
  fillRect(g, 17, 17, 21, 21, 'w');
  fillRect(g, 17, 17, 17, 21, 'wl');
  fillRect(g, 21, 18, 21, 21, 'wd');
  gableRoof(g, 19, 12, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 18, 19, 19, 21, 'dr');

  return city('city-village', {
    g: EARTH.dark, gl: EARTH.mid, gs: EARTH.shadow,
    w: EARTH.mid, wl: EARTH.light, wd: EARTH.shadow,
    th: SAND.mid, thl: SAND.light, thd: SAND.dark,
    dr: OUTLINE,
  }, g);
}

function town(): Sprite {
  const g = makeGrid(SIZE);

  // Road hint: a worn dirt track approaching the hall from the tile's
  // south edge, widening slightly toward the viewer for a hint of depth.
  fillRect(g, 10, 20, 14, 23, 'rd');
  fillRect(g, 11, 20, 13, 23, 'rl');
  shadeDisc(g, 12, 20, 3, 'g', 'gl', 'gs');

  // Central hall — stone-walled and taller than the surrounding huts, the
  // town's civic anchor.
  fillRect(g, 9, 11, 16, 20, 'st');
  fillRect(g, 9, 11, 9, 20, 'stl');
  fillRect(g, 16, 12, 16, 20, 'std');
  gableRoof(g, 12, 3, 5, 8, 'th', 'thl', 'thd');
  fillRect(g, 11, 17, 13, 20, 'dr');

  // Four smaller wood-and-thatch huts, clustered at the corners with
  // narrow gaps between them and the hall — denser than the village.
  fillRect(g, 1, 13, 4, 17, 'w');
  fillRect(g, 1, 13, 1, 17, 'wl');
  fillRect(g, 4, 14, 4, 17, 'wd');
  gableRoof(g, 2, 8, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 2, 15, 3, 17, 'dr');

  fillRect(g, 19, 7, 22, 11, 'w');
  fillRect(g, 19, 7, 19, 11, 'wl');
  fillRect(g, 22, 8, 22, 11, 'wd');
  gableRoof(g, 20, 2, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 20, 9, 21, 11, 'dr');

  fillRect(g, 1, 18, 4, 22, 'w');
  fillRect(g, 1, 18, 1, 22, 'wl');
  fillRect(g, 4, 19, 4, 22, 'wd');
  gableRoof(g, 2, 13, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 2, 20, 3, 22, 'dr');

  fillRect(g, 19, 15, 22, 19, 'w');
  fillRect(g, 19, 15, 19, 19, 'wl');
  fillRect(g, 22, 16, 22, 19, 'wd');
  gableRoof(g, 20, 10, 2, 5, 'th', 'thl', 'thd');
  fillRect(g, 20, 17, 21, 19, 'dr');

  return city('city-town', {
    g: EARTH.dark, gl: EARTH.mid, gs: EARTH.shadow,
    rd: SAND.dark, rl: SAND.mid,
    w: EARTH.mid, wl: EARTH.light, wd: EARTH.shadow,
    st: STONE.mid, stl: STONE.light, std: STONE.dark,
    th: SAND.mid, thl: SAND.light, thd: SAND.dark,
    dr: OUTLINE,
  }, g);
}

function large(): Sprite {
  const g = makeGrid(SIZE);

  // Ground apron in front of the gate.
  shadeDisc(g, 11, 22, 3, 'g', 'gl', 'gs');

  // Curtain wall.
  fillRect(g, 1, 13, 22, 21, 'st');
  fillRect(g, 1, 13, 1, 21, 'stl');
  fillRect(g, 22, 13, 22, 21, 'std');
  fillRect(g, 1, 21, 22, 21, 'std');
  // Crenellations along the top of the wall, skipping the keep and the
  // peeking rooftops so they read as gaps, not clutter.
  plot(g, [[1, 12], [2, 12], [4, 12], [5, 12], [7, 12], [8, 12]], 'stl');
  plot(g, [[15, 12], [16, 12], [18, 12], [19, 12], [21, 12], [22, 12]], 'std');

  // Peeking rooftops of ordinary buildings inside the wall, flanking the
  // keep — only the roofs are visible, the walls hidden behind the curtain.
  gableRoof(g, 4, 9, 2, 3, 'th', 'thl', 'thd');
  gableRoof(g, 19, 9, 2, 3, 'th', 'thl', 'thd');

  // Keep tower, rising above the curtain wall at the center.
  fillRect(g, 9, 5, 14, 13, 'kp');
  fillRect(g, 9, 5, 9, 13, 'kpl');
  fillRect(g, 14, 5, 14, 13, 'kpd');
  setPixel(g, 11, 8, 'win');
  setPixel(g, 12, 8, 'win');
  gableRoof(g, 11, 1, 3, 4, 'th', 'thl', 'thd');
  setPixel(g, 11, 0, 'flag');

  // Gate: a rounded archway cut into the wall, with a dark opening and a
  // wooden double door beneath.
  fillRect(g, 9, 15, 14, 21, 'gt');
  fillRect(g, 10, 14, 13, 14, 'gt');
  fillRect(g, 9, 17, 14, 21, 'dr');
  setPixel(g, 11, 17, 'gt');
  setPixel(g, 12, 17, 'gt');

  return city('city-large', {
    g: EARTH.dark, gl: EARTH.mid, gs: EARTH.shadow,
    st: STONE.mid, stl: STONE.light, std: STONE.dark,
    kp: STONE.dark, kpl: STONE.mid, kpd: STONE.shadow,
    th: SAND.mid, thl: SAND.light, thd: SAND.dark,
    win: OUTLINE, gt: OUTLINE, dr: EARTH.dark, flag: STONE.light,
  }, g);
}

export const CITY_SPRITES: Sprite[] = [village(), town(), large()];
