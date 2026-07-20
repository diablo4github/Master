// Entry point for the pixel asset pipeline: renders every sprite set into
// its spritesheet PNG + manifest JSON. Run via `npm run assets`
// (tsx tools/pixelsmith/build.ts), or import buildAssets() directly (the
// test suite does this with a temp output dir so it never touches assets/).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { encodePng } from './png';
import { packSheet } from './sheet';
import type { Sprite } from './sprite';
import { BUILDING_SPRITES } from './sprites/buildings';
import { CITY_SPRITES } from './sprites/cities';
import { TERRAIN_SPRITES } from './sprites/terrain';
import { UNIT_SPRITES } from './sprites/units';

const DEFAULT_OUT_DIR = fileURLToPath(new URL('../../assets', import.meta.url));

interface SheetSpec {
  name: string;
  cellSize: 16 | 24 | 32;
  sprites: Sprite[];
}

const SHEETS: SheetSpec[] = [
  { name: 'terrain', cellSize: 24, sprites: TERRAIN_SPRITES },
  { name: 'units', cellSize: 16, sprites: UNIT_SPRITES },
  { name: 'buildings', cellSize: 32, sprites: BUILDING_SPRITES },
  { name: 'cities', cellSize: 24, sprites: CITY_SPRITES },
];

/**
 * Render all sheets and write `<name>.png` + `<name>.json` for each into
 * `outDir` (default: the repo's `assets/`). Parameterized so tests can
 * point it at a scratch directory instead.
 */
export async function buildAssets(outDir: string = DEFAULT_OUT_DIR): Promise<void> {
  await mkdir(outDir, { recursive: true });

  for (const sheet of SHEETS) {
    const packed = packSheet(sheet.sprites, sheet.cellSize);
    const png = encodePng(packed.width, packed.height, packed.rgba);

    await writeFile(path.join(outDir, `${sheet.name}.png`), png);
    await writeFile(path.join(outDir, `${sheet.name}.json`), JSON.stringify(packed.manifest, null, 2));

    console.log(
      `pixelsmith: ${sheet.name}.png — ${packed.width}x${packed.height}px, ${sheet.sprites.length} sprites, ${sheet.cellSize}px cells`,
    );
  }
}

// Only run when this file is executed directly (not when imported by tests).
const isMain = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  buildAssets().catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });
}
