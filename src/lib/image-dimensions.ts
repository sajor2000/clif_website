/**
 * Sniff the type and pixel size of a PNG or JPEG from its bytes, without
 * decoding the image. Used when a site PI uploads a signature so the size can
 * be stored alongside the bytes and the letter renderers can scale the image
 * without an image library on the server.
 */

export interface ImageInfo {
  mime: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export function sniffImage(bytes: Uint8Array): ImageInfo | null {
  return sniffPng(bytes) ?? sniffJpeg(bytes);
}

function sniffPng(b: Uint8Array): ImageInfo | null {
  if (b.length < 24 || !PNG_SIGNATURE.every((v, i) => b[i] === v)) return null;
  // The IHDR chunk is always first: width and height are big-endian at 16 and 20.
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  if (!width || !height) return null;
  return { mime: 'image/png', width, height };
}

function sniffJpeg(b: Uint8Array): ImageInfo | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  // Walk the marker segments until a start-of-frame (SOF0..SOF15, except the
  // DHT/JPG/DAC markers that share the range) carries the frame size.
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2;
      continue;
    }
    const length = view.getUint16(i + 2);
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = view.getUint16(i + 5);
      const width = view.getUint16(i + 7);
      if (!width || !height) return null;
      return { mime: 'image/jpeg', width, height };
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / scan data before any SOF
    i += 2 + length;
  }
  return null;
}
