import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  ImageUndecodableError,
  NORMALIZED_MAX_EDGE_PX,
  createSharpImageNormalizer,
} from "./image-normalizer.js";

const normalizer = createSharpImageNormalizer();
const LIMIT = 10 * 1024 * 1024;

async function jpeg(width: number, height: number, options: { orientation?: number } = {}) {
  const base = sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 80, b: 60 } },
  });
  return base
    .withExif({ IFD0: { Copyright: "private", ...{} } })
    .withMetadata(options.orientation ? { orientation: options.orientation } : {})
    .jpeg()
    .toBuffer();
}

describe("createSharpImageNormalizer", () => {
  it("strips camera data from a picture that carries it", async () => {
    const source = await jpeg(300, 200);
    expect((await sharp(source).metadata()).exif).toBeDefined();
    const out = await normalizer.normalize(source, "image/jpeg", LIMIT);
    expect((await sharp(out.bytes).metadata()).exif).toBeUndefined();
    expect(out).toMatchObject({ width: 300, height: 200 });
  });

  it("applies the orientation so the stored size is the size as viewed", async () => {
    const source = await jpeg(300, 200, { orientation: 6 });
    const out = await normalizer.normalize(source, "image/jpeg", LIMIT);
    expect(out).toMatchObject({ width: 200, height: 300 });
  });

  it("scales an oversized picture down to the long-edge limit", async () => {
    const source = await sharp({
      create: { width: 5000, height: 2500, channels: 3, background: "#888" },
    })
      .png()
      .toBuffer();
    const out = await normalizer.normalize(source, "image/png", LIMIT);
    expect(out.width).toBe(NORMALIZED_MAX_EDGE_PX);
    expect(out.height).toBe(2000);
  });

  it("returns a clean picture within the limits unchanged", async () => {
    const source = await sharp({
      create: { width: 64, height: 64, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    const out = await normalizer.normalize(source, "image/png", LIMIT);
    expect(out.bytes.equals(source)).toBe(true);
  });

  it("reports bytes that are not a picture as undecodable", async () => {
    const broken = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.from("not really")]);
    await expect(normalizer.normalize(broken, "image/jpeg", LIMIT)).rejects.toBeInstanceOf(
      ImageUndecodableError,
    );
  });
});
