// Packs a list of rendered Sprites into a single spritesheet: a fixed-column
// grid, plus a manifest that tells the renderer where each sprite id landed.
import { renderSprite, type Sprite } from './sprite';

export interface ManifestEntry {
  id: string;
  x: number;
  y: number;
}

export interface SheetManifest {
  cellSize: number;
  columns: number;
  entries: ManifestEntry[];
}

export interface PackedSheet {
  rgba: Uint8Array;
  width: number;
  height: number;
  manifest: SheetManifest;
}

const DEFAULT_COLUMNS = 8;

/**
 * Lay out `sprites` on a grid of `cellSize` x `cellSize` cells, `columns`
 * wide, growing downward as needed. Every sprite must be exactly `cellSize`
 * pixels square — packSheet does not scale sprites.
 */
export function packSheet(sprites: Sprite[], cellSize: number, columns: number = DEFAULT_COLUMNS): PackedSheet {
  if (sprites.length === 0) {
    throw new Error('packSheet: sprites must be non-empty');
  }
  if (columns <= 0) {
    throw new Error(`packSheet: columns must be positive (got ${columns})`);
  }

  for (const sprite of sprites) {
    if (sprite.size !== cellSize) {
      throw new Error(
        `packSheet: sprite '${sprite.id}' has size ${sprite.size}, but sheet cellSize is ${cellSize}`,
      );
    }
  }

  const rows = Math.ceil(sprites.length / columns);
  const width = columns * cellSize;
  const height = rows * cellSize;
  const rgba = new Uint8Array(width * height * 4);
  const entries: ManifestEntry[] = [];

  sprites.forEach((sprite, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = col * cellSize;
    const y = row * cellSize;

    const pixels = renderSprite(sprite);
    for (let py = 0; py < cellSize; py++) {
      const srcRowStart = py * cellSize * 4;
      const dstRowStart = ((y + py) * width + x) * 4;
      rgba.set(pixels.subarray(srcRowStart, srcRowStart + cellSize * 4), dstRowStart);
    }

    entries.push({ id: sprite.id, x, y });
  });

  return {
    rgba,
    width,
    height,
    manifest: { cellSize, columns, entries },
  };
}
