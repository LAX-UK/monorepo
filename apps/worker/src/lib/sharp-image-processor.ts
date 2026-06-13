import sharp from "sharp";
import type { ImageDimensions, ImageProcessor } from "./image-processor.js";

const LQIP_WIDTH = 24;
const LQIP_BLUR_SIGMA = 4;

/** Sharp-backed image processor for upload-time metadata extraction. */
export class SharpImageProcessor implements ImageProcessor {
  async analyze(buffer: Buffer): Promise<ImageDimensions> {
    const meta = await sharp(buffer).metadata();
    if (!meta.width || !meta.height) {
      throw new Error("image_missing_dimensions");
    }
    return { width: meta.width, height: meta.height };
  }

  async makeLqip(buffer: Buffer): Promise<string> {
    const lqip = await sharp(buffer)
      .resize(LQIP_WIDTH, undefined, { withoutEnlargement: true })
      .blur(LQIP_BLUR_SIGMA)
      .webp({ quality: 20 })
      .toBuffer();
    return `data:image/webp;base64,${lqip.toString("base64")}`;
  }
}
