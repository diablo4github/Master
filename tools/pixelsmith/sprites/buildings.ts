// 32x32 building sprites: the human temple progression, from a modest
// shrine up to the tier-5 "celestial temple" — clean white walls, vertical
// gold-tipped spires, a small gold figure atop the tallest spire. LDS-temple
// inspired: gleaming and geometric, not a gothic cathedral (no flying
// buttresses, gargoyles, or dark stone). Light source is top-left, matching
// every other sprite set in the pipeline.
import type { Sprite } from '../sprite';
import { fillRect, makeGrid, plot, setPixel, toRows, type Grid } from '../pixels';
import { LIFE, STONE } from '../colors';

const SIZE = 32;

function building(id: string, palette: Record<string, string>, grid: Grid): Sprite {
  return { id, size: SIZE, palette, rows: toRows(grid) };
}

/** A symmetric gable roof: a triangle of `chBody`, apex at (apexX, apexY),
 * `height` rows tall, with its left slope in `chHighlight` (lit) and right
 * slope in `chShadow` (shaded) — the top-left light source made explicit. */
function roofTriangle(grid: Grid, apexX: number, apexY: number, height: number, chBody: string, chHighlight: string, chShadow: string): void {
  for (let i = 0; i <= height; i++) {
    const y = apexY + i;
    fillRect(grid, apexX - i, y, apexX + i, y, chBody);
    setPixel(grid, apexX - i, y, chHighlight);
    setPixel(grid, apexX + i, y, chShadow);
  }
}

function templeTier1(): Sprite {
  const g = makeGrid(SIZE);
  // modest gable roof
  roofTriangle(g, 15, 4, 7, 'rf', 'rfl', 'rfd');
  setPixel(g, 15, 3, 'g');
  // wall body
  fillRect(g, 9, 12, 22, 26, 'w');
  fillRect(g, 9, 12, 10, 26, 'wl');
  fillRect(g, 21, 12, 22, 26, 'wd');
  fillRect(g, 8, 11, 23, 11, 'g');
  // flanking columns
  fillRect(g, 12, 14, 12, 26, 'wl');
  fillRect(g, 19, 14, 19, 26, 'wd');
  // entrance recess
  fillRect(g, 14, 18, 17, 26, 'dr');
  // steps
  fillRect(g, 6, 27, 25, 28, 'st');
  fillRect(g, 5, 29, 26, 30, 'st2');
  return building('temple-tier-1', {
    rf: LIFE.white, rfl: LIFE.goldLight, rfd: LIFE.whiteShadow,
    w: LIFE.white, wl: LIFE.goldLight, wd: LIFE.whiteShadow,
    g: LIFE.gold, dr: LIFE.whiteShadow, st: STONE.light, st2: STONE.mid,
  }, g);
}

function templeTier3(): Sprite {
  const g = makeGrid(SIZE);
  // central spire roof + gold tip
  roofTriangle(g, 15, 1, 5, 'rf', 'rfl', 'rfd');
  setPixel(g, 15, 0, 'g');
  // spire tower body with a window
  fillRect(g, 12, 7, 18, 15, 'w');
  fillRect(g, 12, 7, 13, 15, 'wl');
  fillRect(g, 17, 7, 18, 15, 'wd');
  fillRect(g, 14, 10, 16, 12, 'dr');
  // lower flanking wing roofs
  roofTriangle(g, 8, 9, 4, 'rf', 'rfl', 'rfd');
  roofTriangle(g, 22, 9, 4, 'rf', 'rfl', 'rfd');
  // main hall body
  fillRect(g, 5, 14, 26, 27, 'w');
  fillRect(g, 5, 14, 6, 27, 'wl');
  fillRect(g, 24, 14, 26, 27, 'wd');
  fillRect(g, 5, 13, 26, 13, 'g');
  // colonnade
  fillRect(g, 9, 16, 9, 27, 'wl');
  fillRect(g, 13, 16, 13, 27, 'wl');
  fillRect(g, 18, 16, 18, 27, 'wd');
  fillRect(g, 22, 16, 22, 27, 'wd');
  // entrance
  fillRect(g, 13, 20, 18, 27, 'dr');
  // steps
  fillRect(g, 3, 28, 28, 29, 'st');
  fillRect(g, 2, 30, 29, 31, 'st2');
  return building('temple-tier-3', {
    rf: LIFE.white, rfl: LIFE.goldLight, rfd: LIFE.whiteShadow,
    w: LIFE.white, wl: LIFE.goldLight, wd: LIFE.whiteShadow,
    g: LIFE.gold, dr: LIFE.whiteShadow, st: STONE.light, st2: STONE.mid,
  }, g);
}

function celestialTemple(): Sprite {
  const g = makeGrid(SIZE);
  // two short corner spires
  roofTriangle(g, 7, 8, 3, 'rf', 'rfl', 'rfd');
  roofTriangle(g, 24, 8, 3, 'rf', 'rfl', 'rfd');
  setPixel(g, 7, 7, 'g');
  setPixel(g, 24, 7, 'g');
  // two medium flanking spires
  roofTriangle(g, 11, 5, 5, 'rf', 'rfl', 'rfd');
  roofTriangle(g, 20, 5, 5, 'rf', 'rfl', 'rfd');
  setPixel(g, 11, 4, 'g');
  setPixel(g, 20, 4, 'g');
  // the tallest, central spire, gold-tipped with a tiny gold figure atop it
  roofTriangle(g, 15, 2, 4, 'rf', 'rfl', 'rfd');
  setPixel(g, 15, 2, 'g');
  setPixel(g, 15, 1, 'fig');
  setPixel(g, 15, 0, 'fig');
  // central spire tower body
  fillRect(g, 12, 6, 18, 11, 'w');
  fillRect(g, 12, 6, 13, 11, 'wl');
  fillRect(g, 17, 6, 18, 11, 'wd');
  // grand gold cornice, full width
  fillRect(g, 3, 11, 28, 11, 'g');
  // main hall body
  fillRect(g, 3, 12, 28, 27, 'w');
  fillRect(g, 3, 12, 4, 27, 'wl');
  fillRect(g, 26, 12, 28, 27, 'wd');
  // grand colonnade
  for (let x = 7; x <= 24; x += 3) {
    fillRect(g, x, 14, x, 27, x < 15 ? 'wl' : 'wd');
  }
  // grand entrance
  fillRect(g, 12, 19, 19, 27, 'dr');
  fillRect(g, 13, 20, 18, 27, 'drl');
  // gleaming sparkle accents
  plot(g, [[9, 9], [22, 9], [5, 14], [27, 16]], 'spk');
  // grand staircase
  fillRect(g, 1, 28, 30, 29, 'st');
  fillRect(g, 0, 30, 31, 31, 'st2');
  return building('temple-tier-5', {
    rf: LIFE.white, rfl: LIFE.goldLight, rfd: LIFE.whiteShadow,
    w: LIFE.white, wl: LIFE.goldLight, wd: LIFE.whiteShadow,
    g: LIFE.gold, fig: LIFE.goldDark, dr: LIFE.whiteShadow, drl: STONE.dark,
    spk: LIFE.goldLight, st: STONE.light, st2: STONE.mid,
  }, g);
}

export const BUILDING_SPRITES: Sprite[] = [templeTier1(), templeTier3(), celestialTemple()];
