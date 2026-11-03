import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  NORMALIZED_MAX_BYTES,
  NORMALIZED_MAX_EDGE_PX,
  createSharpImageNormalizer,
} from "./sharp-image-normalizer.js";

const normalizer = createSharpImageNormalizer();

/** Noise defeats compression, so a modest canvas still yields a large file. */
function noise(width: number, height: number): Buffer {
  const raw = Buffer.alloc(width * height * 3);
  for (let i = 0; i < raw.length; i += 1) raw[i] = (i * 2654435761) >>> 24;
  return raw;
}

function jpeg(width: number, height: number, quality = 100) {
  return sharp(noise(width, height), { raw: { width, height, channels: 3 } })
    .jpeg({ quality })
    .toBuffer();
}

describe("createSharpImageNormalizer", () => {
  it("scales a JPEG over the byte limit down to fit, keeping the format", async () => {
    const big = await jpeg(4800, 3200);
    expect(big.byteLength).toBeGreaterThan(NORMALIZED_MAX_BYTES);
    const out = await normalizer.normalize(big, "image/jpeg");
    expect(out.stored.bytes).toBeLessThanOrEqual(NORMALIZED_MAX_BYTES);
    expect(out.bytes.byteLength).toBe(out.stored.bytes);
    expect(Math.max(out.stored.width, out.stored.height)).toBeLessThanOrEqual(
      NORMALIZED_MAX_EDGE_PX,
    );
    expect(out.original).toEqual({ width: 4800, height: 3200, bytes: big.byteLength });
    expect((await sharp(out.bytes).metadata()).format).toBe("jpeg");
  }, 60_000);

  it("keeps an EXIF-rotated portrait portrait and drops the EXIF block", async () => {
    // Stored landscape with orientation 6: viewers show it as portrait.
    const rotated = await sharp(noise(300, 200), { raw: { width: 300, height: 200, channels: 3 } })
      .withMetadata({ orientation: 6 })
      .jpeg()
      .toBuffer();
    const out = await normalizer.normalize(rotated, "image/jpeg");
    expect(out.stored.height).toBeGreaterThan(out.stored.width);
    expect({ w: out.stored.width, h: out.stored.height }).toEqual({ w: 200, h: 300 });
    const meta = await sharp(out.bytes).metadata();
    expect(meta.exif).toBeUndefined();
    expect((meta.orientation ?? 1) === 1).toBe(true);
    expect(meta.height).toBeGreaterThan(meta.width ?? 0);
  });

  it("keeps PNG as PNG when scaling an oversized edge", async () => {
    const png = await sharp({
      create: { width: 5000, height: 1000, channels: 3, background: "#336699" },
    })
      .png()
      .toBuffer();
    const out = await normalizer.normalize(png, "image/png");
    expect(out.stored.width).toBe(NORMALIZED_MAX_EDGE_PX);
    expect((await sharp(out.bytes).metadata()).format).toBe("png");
  });

  it("rejects bytes that are not a decodable image", async () => {
    await expect(
      normalizer.normalize(Buffer.from("<html>nope</html>"), "image/jpeg"),
    ).rejects.toThrow();
  });

  it("returns a small image without EXIF byte for byte", async () => {
    const small = await jpeg(200, 100, 80);
    const out = await normalizer.normalize(small, "image/jpeg");
    expect(out.bytes.equals(small)).toBe(true);
    expect(out.stored).toEqual({ width: 200, height: 100, bytes: small.byteLength });
  });
});
