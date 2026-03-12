import sharp from 'sharp';

const MAX_WIDTH = 1200;
const MAX_HEIGHT = 1200;
const QUALITY_STEPS = [80, 70, 60, 50, 40, 30];

/**
 * Compress an image buffer to be at most `maxBytes`.
 * Converts to WEBP, down-scales if wider/taller than 1200 px,
 * then iteratively lowers quality until size fits.
 */
export async function compressImageToMaxBytes(buffer, maxBytes = 250 * 1024) {
  // If it's already an incredibly small buffer, leave it, but we usually want to WebP it anyway.
  if (!Buffer.isBuffer(buffer)) return buffer;

  try {
    const meta = await sharp(buffer).metadata();
    const needsResize =
      meta.width && meta.height && (meta.width > MAX_WIDTH || meta.height > MAX_HEIGHT);

    const base = () => {
      let p = sharp(buffer).rotate(); // auto-rotate based on EXIF
      if (needsResize) {
        p = p.resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true });
      }
      return p;
    };

    // Attempt default WEBP encoding first
    let result = await base().webp({ quality: 85 }).toBuffer();
    if (result.length <= maxBytes) return result;

    // Reduce quality incrementally if it's still too large
    for (const q of QUALITY_STEPS) {
      result = await sharp(buffer)
        .rotate()
        .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: q })
        .toBuffer();
      if (result.length <= maxBytes) return result;
    }

    return result;
  } catch {
    return buffer;
  }
}
