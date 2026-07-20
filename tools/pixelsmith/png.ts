// Minimal PNG encoder — just enough to write 8-bit RGBA, non-interlaced
// PNGs with a single IDAT chunk. Compression comes from node:zlib (deflate),
// so we don't need to implement any of that ourselves — only the PNG
// container format (signature + chunks) and CRC32.
import { deflateSync } from 'node:zlib';

// The fixed 8-byte sequence that opens every PNG file.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// PNG's CRC32 uses the standard zlib/gzip polynomial (0xEDB88320), computed
// over each chunk's type + data bytes. We build the 256-entry lookup table
// once at module load, then reuse it for every chunk.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    const tableEntry = CRC_TABLE[(c ^ buf[i]!) & 0xff]!;
    c = tableEntry ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

// Wraps `type` (4 ASCII chars) + `data` into a length-prefixed, CRC-suffixed
// PNG chunk: [uint32 length][type][data][uint32 crc].
function chunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcInput), 0);

  return Buffer.concat([length, typeBuf, data, crc]);
}

/**
 * Encode raw 8-bit RGBA pixel data as a PNG file buffer.
 *
 * @param width  image width in pixels
 * @param height image height in pixels
 * @param rgba   width * height * 4 bytes, row-major, top-to-bottom, RGBA
 */
export function encodePng(width: number, height: number, rgba: Uint8Array): Buffer {
  if (width <= 0 || height <= 0) {
    throw new Error(`encodePng: width and height must be positive (got ${width}x${height})`);
  }
  const expected = width * height * 4;
  if (rgba.length !== expected) {
    throw new Error(`encodePng: rgba length ${rgba.length} does not match ${width}x${height} RGBA (expected ${expected})`);
  }

  // IHDR: image header. Bit depth 8, color type 6 (RGBA), no interlacing.
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // color type: truecolor + alpha
  ihdr.writeUInt8(0, 10); // compression method
  ihdr.writeUInt8(0, 11); // filter method
  ihdr.writeUInt8(0, 12); // interlace method

  // Raw scanline data: PNG prefixes every row with a filter-type byte.
  // Filter 0 ("None") keeps this simple — no per-pixel prediction.
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const srcStart = y * stride;
    const dstStart = y * (stride + 1);
    raw[dstStart] = 0; // filter type: None
    Buffer.from(rgba.buffer, rgba.byteOffset + srcStart, stride).copy(raw, dstStart + 1);
  }

  const idatData = deflateSync(raw);

  return Buffer.concat([
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
