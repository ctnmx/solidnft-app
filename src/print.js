/*
 * Règles produit du tirage aluminium.
 *
 * Le ratio de l'image importée est conservé : le slider pilote le grand côté
 * en centimètres entiers (pas de 1 cm) et le petit côté en est déduit.
 * Bornes : 15 cm minimum sur le petit côté, 120 cm maximum sur le petit côté
 * et 240 cm maximum sur le grand côté — soit 15×15 cm au minimum et
 * 120×240 cm au maximum.
 */

export const MIN_SIDE_CM = 15;
export const MAX_SHORT_CM = 120;
export const MAX_LONG_CM = 240;
export const PRICE_PER_M2 = 754.8; // € TTC

/* Grand côté / petit côté, toujours >= 1. */
export function aspectOf(pxWidth, pxHeight) {
  const long = Math.max(pxWidth, pxHeight);
  const short = Math.min(pxWidth, pxHeight);
  return short > 0 ? long / short : 1;
}

/* Plage du slider, exprimée sur le grand côté. */
export function sizingRange(pxWidth, pxHeight) {
  const aspect = aspectOf(pxWidth, pxHeight);

  let min = Math.ceil(MIN_SIDE_CM * aspect);
  const max = Math.min(MAX_LONG_CM, Math.floor(MAX_SHORT_CM * aspect));

  // Ratio trop panoramique : le petit côté ne peut pas atteindre 15 cm
  // sans dépasser 240 cm sur le grand côté.
  const outOfRange = min > max;
  if (outOfRange) min = max;

  return { min, max, aspect, outOfRange };
}

/* Dimensions affichées (entiers) pour une valeur de slider donnée. */
export function sizeFor(longCm, pxWidth, pxHeight) {
  const aspect = aspectOf(pxWidth, pxHeight);
  const longSide = Math.round(longCm);
  const shortSide = Math.max(MIN_SIDE_CM, Math.round(longSide / aspect));
  const landscape = pxWidth >= pxHeight;

  return {
    widthCm: landscape ? longSide : shortSide,
    heightCm: landscape ? shortSide : longSide,
    longCm: longSide,
    shortCm: shortSide,
  };
}

export function areaM2(widthCm, heightCm) {
  return (widthCm * heightCm) / 10000;
}

export function priceFor(widthCm, heightCm) {
  return areaM2(widthCm, heightCm) * PRICE_PER_M2;
}

/* DPI effectif au format d'impression choisi. */
export function printDpi(pxWidth, pxHeight, widthCm, heightCm) {
  const byWidth = widthCm > 0 ? pxWidth / (widthCm / 2.54) : 0;
  const byHeight = heightCm > 0 ? pxHeight / (heightCm / 2.54) : 0;
  return Math.round(Math.min(byWidth, byHeight));
}

/* Valeur de départ du slider : ~60 cm de grand côté, ramenée dans la plage. */
export function defaultLongSide(range) {
  return Math.min(range.max, Math.max(range.min, 60));
}

const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));

/* "4:3" quand le ratio se réduit proprement, "1,78:1" sinon. */
export function formatRatio(pxWidth, pxHeight) {
  const divisor = gcd(pxWidth, pxHeight) || 1;
  const a = pxWidth / divisor;
  const b = pxHeight / divisor;

  if (a <= 40 && b <= 40) return `${a}:${b}`;

  const aspect = pxWidth / pxHeight;
  return aspect >= 1
    ? `${formatNumber(aspect, 2)}:1`
    : `1:${formatNumber(1 / aspect, 2)}`;
}

export function formatNumber(value, decimals = 0) {
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPixels(value) {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatPrice(value) {
  return `${formatNumber(value, 2)} € TTC`;
}

export function formatBytes(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${formatNumber(bytes / 1024, 0)} Ko`;
  return `${formatNumber(bytes / (1024 * 1024), 1)} Mo`;
}
