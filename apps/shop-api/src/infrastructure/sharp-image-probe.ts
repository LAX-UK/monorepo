import sharp from "sharp";
import type { ImageProbePort } from "../application/ports/image-probe.port.js";

const LQIP_WIDTH = 24;
const LQIP_BLUR_SIGMA = 4;

export function createSharpImageProbe(): ImageProbePort {
  return {
    async analyze(buffer: Buffer) {
      const meta = await sharp(buffer).metadata();
      if (!meta.width || !meta.height) {
        throw new Error("image_missing_dimensions");
      }
      return { width: meta.width, height: meta.height };
    },
    async makeLqip(buffer: Buffer) {
      const lqip = await sharp(buffer)
        .resize(LQIP_WIDTH, undefined, { withoutEnlargement: true })
        .blur(LQIP_BLUR_SIGMA)
        .webp({ quality: 20 })
        .toBuffer();
      return `data:image/webp;base64,${lqip.toString("base64")}`;
    },
  };
}
