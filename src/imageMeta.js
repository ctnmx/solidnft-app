/*
 * Lecture des métadonnées d'une image côté navigateur.
 *
 * On extrait le DPI réellement inscrit dans le fichier :
 *   - JPEG : segment APP0/JFIF (densité) ou APP1/Exif (XResolution)
 *   - PNG  : chunk pHYs (pixels par mètre)
 *   - WEBP : chunk RIFF "EXIF" le cas échéant
 * Faute de métadonnée, on retombe sur 72 DPI (convention écran).
 */

export const DEFAULT_DPI = 72;

export const ACCEPTED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
  'image/bmp',
  'image/tiff',
];

export const ACCEPTED_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.avif',
  '.gif',
  '.bmp',
  '.tif',
  '.tiff',
];

export const ACCEPTED_LABEL = 'JPG, JPEG, PNG, WEBP, AVIF, GIF, BMP, TIFF';

export function isAcceptedFile(file) {
  if (!file) return false;
  if (file.type && ACCEPTED_TYPES.includes(file.type.toLowerCase())) return true;
  const name = (file.name || '').toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/* ------------------------------------------------------------------ */
/* Lecture binaire                                                     */
/* ------------------------------------------------------------------ */

const u16 = (v, o, le) => (le ? v.getUint16(o, true) : v.getUint16(o, false));
const u32 = (v, o, le) => (le ? v.getUint32(o, true) : v.getUint32(o, false));

/* Bloc TIFF (utilisé par Exif, présent dans JPEG et WEBP). */
function readTiffResolution(view, start) {
  if (start + 8 > view.byteLength) return null;

  const order = view.getUint16(start, false);
  let little;
  if (order === 0x4949) little = true;
  else if (order === 0x4d4d) little = false;
  else return null;

  if (u16(view, start + 2, little) !== 42) return null;

  const ifdOffset = u32(view, start + 4, little);
  const ifd = start + ifdOffset;
  if (ifd + 2 > view.byteLength) return null;

  const count = u16(view, ifd, little);
  let xRes = null;
  let unit = 2; // 2 = pouce, 3 = centimètre

  for (let i = 0; i < count; i += 1) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;

    const tag = u16(view, entry, little);

    if (tag === 0x011a) {
      const valueOffset = start + u32(view, entry + 8, little);
      if (valueOffset + 8 <= view.byteLength) {
        const num = u32(view, valueOffset, little);
        const den = u32(view, valueOffset + 4, little);
        if (den !== 0) xRes = num / den;
      }
    } else if (tag === 0x0128) {
      unit = u16(view, entry + 8, little);
    }
  }

  if (!xRes || xRes <= 0) return null;
  return unit === 3 ? xRes * 2.54 : xRes;
}

function readJpegDpi(view) {
  if (view.byteLength < 4) return null;
  if (view.getUint16(0, false) !== 0xffd8) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) {
      offset += 1; // resynchronisation sur le prochain marqueur
      continue;
    }

    const marker = view.getUint8(offset + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) break; // fin ou début des données image

    const length = view.getUint16(offset + 2, false);
    const data = offset + 4;
    if (length < 2 || data + length - 2 > view.byteLength) break;

    if (marker === 0xe0 && data + 12 <= view.byteLength) {
      // APP0 / JFIF
      const jfif =
        view.getUint8(data) === 0x4a &&
        view.getUint8(data + 1) === 0x46 &&
        view.getUint8(data + 2) === 0x49 &&
        view.getUint8(data + 3) === 0x46;
      if (jfif) {
        const units = view.getUint8(data + 7);
        const x = view.getUint16(data + 8, false);
        if (x > 0 && units === 1) return x;
        if (x > 0 && units === 2) return x * 2.54;
      }
    }

    if (marker === 0xe1 && data + 6 <= view.byteLength) {
      // APP1 / Exif
      const exif =
        view.getUint8(data) === 0x45 &&
        view.getUint8(data + 1) === 0x78 &&
        view.getUint8(data + 2) === 0x69 &&
        view.getUint8(data + 3) === 0x66;
      if (exif) {
        const dpi = readTiffResolution(view, data + 6);
        if (dpi) return dpi;
      }
    }

    offset = data + length - 2;
  }

  return null;
}

function readPngDpi(view) {
  if (view.byteLength < 16) return null;
  if (view.getUint32(0, false) !== 0x89504e47) return null;

  let offset = 8;
  while (offset + 8 <= view.byteLength) {
    const length = view.getUint32(offset, false);
    const type = String.fromCharCode(
      view.getUint8(offset + 4),
      view.getUint8(offset + 5),
      view.getUint8(offset + 6),
      view.getUint8(offset + 7)
    );
    const data = offset + 8;

    if (type === 'pHYs' && data + 9 <= view.byteLength) {
      const ppuX = view.getUint32(data, false);
      const unit = view.getUint8(data + 8);
      if (unit === 1 && ppuX > 0) return ppuX * 0.0254; // pixels/mètre -> DPI
      return null;
    }
    if (type === 'IDAT' || type === 'IEND') return null;

    offset = data + length + 4; // données + CRC
  }

  return null;
}

function readWebpDpi(view) {
  if (view.byteLength < 16) return null;
  if (view.getUint32(0, false) !== 0x52494646) return null; // "RIFF"
  if (view.getUint32(8, false) !== 0x57454250) return null; // "WEBP"

  let offset = 12;
  while (offset + 8 <= view.byteLength) {
    const fourcc = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );
    const size = view.getUint32(offset + 4, true);
    let data = offset + 8;

    if (fourcc === 'EXIF') {
      // Certains encodeurs préfixent le bloc TIFF par "Exif\0\0".
      if (
        data + 6 <= view.byteLength &&
        view.getUint8(data) === 0x45 &&
        view.getUint8(data + 1) === 0x78 &&
        view.getUint8(data + 2) === 0x69 &&
        view.getUint8(data + 3) === 0x66
      ) {
        data += 6;
      }
      const dpi = readTiffResolution(view, data);
      if (dpi) return dpi;
    }

    offset = data + size + (size % 2); // les chunks RIFF sont alignés sur 2 octets
  }

  return null;
}

export function readDpi(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  try {
    const dpi = readJpegDpi(view) || readPngDpi(view) || readWebpDpi(view);
    if (dpi && dpi > 0) {
      return { dpi: Math.round(dpi), embedded: true };
    }
  } catch (err) {
    // métadonnées illisibles : on garde la valeur par défaut
  }
  return { dpi: DEFAULT_DPI, embedded: false };
}

/* ------------------------------------------------------------------ */
/* Analyse complète                                                    */
/* ------------------------------------------------------------------ */

function decodeDimensions(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
      });
    img.onerror = () => reject(new Error('decode'));
    img.src = url;
  });
}

/*
 * Renvoie { url, name, width, height, pixels, ratio, dpi, dpiEmbedded }.
 * `url` est un object URL : à révoquer par l'appelant.
 */
export async function analyseImageFile(file) {
  const url = URL.createObjectURL(file);

  let dimensions;
  try {
    dimensions = await decodeDimensions(url);
  } catch (err) {
    URL.revokeObjectURL(url);
    throw new Error("Ce fichier n'a pas pu être décodé comme une image.");
  }

  if (!dimensions.width || !dimensions.height) {
    URL.revokeObjectURL(url);
    throw new Error("Dimensions de l'image introuvables.");
  }

  const { dpi, embedded } = readDpi(await file.arrayBuffer());

  return {
    url,
    name: file.name || 'image',
    bytes: file.size,
    width: dimensions.width,
    height: dimensions.height,
    pixels: dimensions.width * dimensions.height,
    ratio: dimensions.width / dimensions.height,
    dpi,
    dpiEmbedded: embedded,
  };
}
