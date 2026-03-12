import sharp from "sharp";

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY_STEPS = [82, 72, 60, 48, 35, 22];

/**
 * Compress an image buffer to be at most `maxBytes`.
 * Converts to JPEG, down-scales if wider/taller than 1920 px,
 * then iteratively lowers quality until size fits.
 * Returns the original buffer untouched when it's already small enough.
 */
export async function compressImageToMaxBytes(
  input: Buffer,
  maxBytes: number
): Promise<Buffer> {
  if (input.length <= maxBytes) return input;

  try {
    let pipeline = sharp(input).rotate().jpeg({ mozjpeg: true, quality: 85 });

    const meta = await sharp(input).metadata();
    if (
      meta.width &&
      meta.height &&
      (meta.width > MAX_WIDTH || meta.height > MAX_HEIGHT)
    ) {
      pipeline = sharp(input)
        .rotate()
        .resize({
          width: MAX_WIDTH,
          height: MAX_HEIGHT,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ mozjpeg: true, quality: 85 });
    }

    let result = await pipeline.toBuffer();
    if (result.length <= maxBytes) return result;

    for (const q of QUALITY_STEPS) {
      result = await sharp(input)
        .rotate()
        .resize({
          width: MAX_WIDTH,
          height: MAX_HEIGHT,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ mozjpeg: true, quality: q })
        .toBuffer();
      if (result.length <= maxBytes) return result;
    }

    return result;
  } catch {
    return input;
  }
}
