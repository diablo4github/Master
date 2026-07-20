import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildAssets } from './build';
import { encodePng } from './png';
import { packSheet } from './sheet';
import { renderSprite, type Sprite } from './sprite';
import { BATTLE_SPRITES, LAIR_SPRITES } from './sprites/battle';
import { BUILDING_SPRITES } from './sprites/buildings';
import { CITY_SPRITES } from './sprites/cities';
import { TERRAIN_SPRITES } from './sprites/terrain';
import { UNIT_SPRITES } from './sprites/units';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeFlatSprite(id: string, size: 16 | 24 | 32 = 16): Sprite {
  return {
    id,
    size,
    palette: { x: '#ff0000' },
    rows: Array.from({ length: size }, () => 'x'.repeat(size)),
  };
}

describe('encodePng', () => {
  it('produces a buffer starting with the PNG signature', () => {
    const rgba = new Uint8Array(3 * 2 * 4);
    const buf = encodePng(3, 2, rgba);
    expect(buf.subarray(0, 8)).toEqual(PNG_SIGNATURE);
  });

  it('writes a decodable IHDR chunk with the right dimensions', () => {
    const width = 5;
    const height = 7;
    const rgba = new Uint8Array(width * height * 4);
    const buf = encodePng(width, height, rgba);

    // Chunk layout after the 8-byte signature: [len:4][type:4][data...][crc:4].
    // IHDR is always the first chunk.
    const length = buf.readUInt32BE(8);
    const type = buf.subarray(12, 16).toString('ascii');
    expect(type).toBe('IHDR');
    expect(length).toBe(13);

    const ihdrData = buf.subarray(16, 16 + 13);
    expect(ihdrData.readUInt32BE(0)).toBe(width);
    expect(ihdrData.readUInt32BE(4)).toBe(height);
    expect(ihdrData.readUInt8(8)).toBe(8); // bit depth
    expect(ihdrData.readUInt8(9)).toBe(6); // color type: RGBA

    // The file should also end with an IEND chunk.
    const iendType = buf.subarray(buf.length - 8, buf.length - 4).toString('ascii');
    expect(iendType).toBe('IEND');
  });

  it('rejects mismatched rgba length', () => {
    expect(() => encodePng(4, 4, new Uint8Array(10))).toThrow();
  });
});

describe('renderSprite', () => {
  it('renders a flat sprite to the expected byte length', () => {
    const sprite = makeFlatSprite('flat');
    const out = renderSprite(sprite);
    expect(out.length).toBe(16 * 16 * 4);
    // First pixel should be opaque red.
    expect([out[0], out[1], out[2], out[3]]).toEqual([255, 0, 0, 255]);
  });

  it('leaves "." pixels transparent', () => {
    const sprite: Sprite = { id: 'dot', size: 16, palette: { x: '#00ff00' }, rows: Array.from({ length: 16 }, (_, y) => (y === 0 ? '.' + 'x'.repeat(15) : 'x'.repeat(16))) };
    const out = renderSprite(sprite);
    expect([out[0], out[1], out[2], out[3]]).toEqual([0, 0, 0, 0]);
  });

  it('rejects a sprite with the wrong number of rows', () => {
    const sprite = makeFlatSprite('bad-row-count');
    sprite.rows = sprite.rows.slice(0, 10);
    expect(() => renderSprite(sprite)).toThrow(/row/i);
  });

  it('rejects a sprite with a row of the wrong length', () => {
    const sprite = makeFlatSprite('bad-row-length');
    sprite.rows[0] = 'x';
    expect(() => renderSprite(sprite)).toThrow(/length/i);
  });

  it('rejects a sprite with an unknown palette character', () => {
    const sprite = makeFlatSprite('bad-char');
    sprite.rows[0] = '?' + 'x'.repeat(15);
    expect(() => renderSprite(sprite)).toThrow(/unknown/i);
  });
});

describe('packSheet', () => {
  it('lays out manifest entries within sheet bounds, on the cell grid', () => {
    const sprites = Array.from({ length: 10 }, (_, i) => makeFlatSprite(`s${i}`));
    const cellSize = 16;
    const columns = 8;
    const packed = packSheet(sprites, cellSize, columns);

    expect(packed.width).toBe(columns * cellSize);
    expect(packed.manifest.entries).toHaveLength(sprites.length);

    for (const entry of packed.manifest.entries) {
      expect(entry.x).toBeGreaterThanOrEqual(0);
      expect(entry.y).toBeGreaterThanOrEqual(0);
      expect(entry.x + cellSize).toBeLessThanOrEqual(packed.width);
      expect(entry.y + cellSize).toBeLessThanOrEqual(packed.height);
      expect(entry.x % cellSize).toBe(0);
      expect(entry.y % cellSize).toBe(0);
    }
    // rgba buffer must actually match width * height * 4.
    expect(packed.rgba.length).toBe(packed.width * packed.height * 4);
  });

  it('rejects a sprite whose size does not match the sheet cellSize', () => {
    const sprites = [makeFlatSprite('wrong-size', 32)];
    expect(() => packSheet(sprites, 16)).toThrow();
  });
});

describe('TERRAIN_SPRITES', () => {
  it('are all authored at the 24x24 terrain cell size', () => {
    for (const sprite of TERRAIN_SPRITES) {
      expect(sprite.size).toBe(24);
      expect(sprite.rows).toHaveLength(24);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(24);
      }
    }
  });
});

describe('CITY_SPRITES', () => {
  it('has exactly 3 sprites, all authored at the 24x24 tile cell size', () => {
    expect(CITY_SPRITES).toHaveLength(3);
    for (const sprite of CITY_SPRITES) {
      expect(sprite.size).toBe(24);
      expect(sprite.rows).toHaveLength(24);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(24);
      }
    }
  });
});

describe('UNIT_SPRITES', () => {
  it('has exactly 5 sprites, all authored at the 16x16 unit cell size', () => {
    expect(UNIT_SPRITES).toHaveLength(5);
    for (const sprite of UNIT_SPRITES) {
      expect(sprite.size).toBe(16);
      expect(sprite.rows).toHaveLength(16);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(16);
      }
    }
  });
});

describe('BATTLE_SPRITES', () => {
  it('has exactly 14 sprites, one per archetype, all authored at the 16x16 unit cell size', () => {
    expect(BATTLE_SPRITES).toHaveLength(14);
    for (const sprite of BATTLE_SPRITES) {
      expect(sprite.size).toBe(16);
      expect(sprite.rows).toHaveLength(16);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(16);
      }
    }
  });

  it('has 14 distinct sprite ids', () => {
    const ids = new Set(BATTLE_SPRITES.map((s) => s.id));
    expect(ids.size).toBe(14);
  });
});

describe('LAIR_SPRITES', () => {
  it('has exactly 1 sprite, authored at the 24x24 strategic-map cell size', () => {
    expect(LAIR_SPRITES).toHaveLength(1);
    for (const sprite of LAIR_SPRITES) {
      expect(sprite.size).toBe(24);
      expect(sprite.rows).toHaveLength(24);
      for (const row of sprite.rows) {
        expect(row).toHaveLength(24);
      }
    }
  });
});

describe('buildAssets', () => {
  let outDir: string;

  afterEach(async () => {
    if (outDir) await rm(outDir, { recursive: true, force: true });
  });

  it('writes terrain/units/buildings/cities/battle/lair PNGs and manifests to a scratch dir', async () => {
    outDir = await mkdtemp(path.join(tmpdir(), 'pixelsmith-test-'));
    await buildAssets(outDir);

    const sheets: Array<{ name: string; count: number; cellSize: number }> = [
      { name: 'terrain', count: TERRAIN_SPRITES.length, cellSize: 24 },
      { name: 'units', count: UNIT_SPRITES.length, cellSize: 16 },
      { name: 'buildings', count: BUILDING_SPRITES.length, cellSize: 32 },
      { name: 'cities', count: CITY_SPRITES.length, cellSize: 24 },
      { name: 'battle', count: BATTLE_SPRITES.length, cellSize: 16 },
      { name: 'lair', count: LAIR_SPRITES.length, cellSize: 24 },
    ];

    for (const sheet of sheets) {
      const pngBuf = await readFile(path.join(outDir, `${sheet.name}.png`));
      expect(pngBuf.subarray(0, 8)).toEqual(PNG_SIGNATURE);

      const manifestRaw = await readFile(path.join(outDir, `${sheet.name}.json`), 'utf8');
      const manifest = JSON.parse(manifestRaw) as { cellSize: number; columns: number; entries: unknown[] };
      expect(manifest.cellSize).toBe(sheet.cellSize);
      expect(manifest.entries).toHaveLength(sheet.count);
    }
  });
});
