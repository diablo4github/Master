// The authoring model for pixelsmith: a Sprite is pure data — a palette of
// named colors plus a character grid that paints those colors pixel by
// pixel. This is what makes art "reproducible and restyleable in bulk": to
// re-theme a sprite you edit the palette, not the pixels.

/** Supported square sprite sizes (pixels per side). */
export type SpriteSize = 16 | 24 | 32;

export interface Sprite {
  /** Lowercase kebab-case id, e.g. 'grassland' or 'orc-warrior'. */
  id: string;
  /** Sprite is size x size pixels. */
  size: SpriteSize;
  /**
   * Maps a single character (as used in `rows`) to a color string:
   * '#rrggbb' (opaque) or '#rrggbbaa' (explicit alpha). The character '.'
   * is reserved for transparent and must not be used as a palette key.
   */
  palette: Record<string, string>;
  /** `size` strings, each exactly `size` characters, top row first. */
  rows: string[];
}

const HEX_COLOR_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

function parseColor(id: string, key: string, value: string): Rgba {
  const match = HEX_COLOR_RE.exec(value);
  if (!match) {
    throw new Error(
      `sprite '${id}': palette['${key}'] = '${value}' is not a valid '#rrggbb' or '#rrggbbaa' color`,
    );
  }
  const hex = match[1]!;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) : 255;
  return { r, g, b, a };
}

/**
 * Render a Sprite to raw RGBA pixel data (size * size * 4 bytes, row-major,
 * top-to-bottom). Throws on malformed sprites: wrong row count, wrong row
 * length, or a grid character with no palette entry (other than '.').
 */
export function renderSprite(sprite: Sprite): Uint8Array {
  const { id, size, palette, rows } = sprite;

  if ('.' in palette) {
    throw new Error(`sprite '${id}': palette must not define '.' — it is reserved for transparent`);
  }
  if (rows.length !== size) {
    throw new Error(`sprite '${id}': expected ${size} rows, got ${rows.length}`);
  }

  // Parse the palette up front so we fail fast on bad color strings and
  // avoid re-parsing the same hex string for every pixel that uses it.
  const resolved = new Map<string, Rgba>();
  for (const [key, value] of Object.entries(palette)) {
    resolved.set(key, parseColor(id, key, value));
  }

  const out = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    const row = rows[y]!;
    if (row.length !== size) {
      throw new Error(`sprite '${id}': row ${y} has length ${row.length}, expected ${size}`);
    }
    for (let x = 0; x < size; x++) {
      const ch = row[x]!;
      const offset = (y * size + x) * 4;
      if (ch === '.') {
        // Transparent: leave RGBA at zero.
        continue;
      }
      const color = resolved.get(ch);
      if (!color) {
        throw new Error(
          `sprite '${id}': row ${y} col ${x} uses unknown palette char '${ch}' (not in palette, not '.')`,
        );
      }
      out[offset] = color.r;
      out[offset + 1] = color.g;
      out[offset + 2] = color.b;
      out[offset + 3] = color.a;
    }
  }

  return out;
}
