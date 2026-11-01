import { assembleCoverAnalysis } from "@auction/domain";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { SharpCoverImageAnalyser } from "./sharp-cover-image-analyser.js";

const analyser = new SharpCoverImageAnalyser();

async function solid(width: number, height: number, hex: string): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: hex } })
    .jpeg({ quality: 95 })
    .toBuffer();
}

/** Dark on the left half, pale on the right half. */
async function split(width: number, height: number): Promise<Buffer> {
  const left = await sharp({
    create: { width: width / 2, height, channels: 3, background: "#14161a" },
  })
    .png()
    .toBuffer();
  const right = await sharp({
    create: { width: width / 2, height, channels: 3, background: "#f2efe6" },
  })
    .png()
    .toBuffer();
  return sharp({ create: { width, height, channels: 3, background: "#000000" } })
    .composite([
      { input: left, left: 0, top: 0 },
      { input: right, left: width / 2, top: 0 },
    ])
    .jpeg({ quality: 95 })
    .toBuffer();
}

const lightness = (hex: string | undefined) => Number.parseInt((hex ?? "#000000").slice(1, 3), 16);

const request = {
  focal: { x: 0.5, y: 0.5 },
  zoom: 1,
  textSide: "left" as const,
  breakpoints: ["desktop", "wide"] as const,
};

describe("SharpCoverImageAnalyser", () => {
  it("reads the colours, a 24px preview and every text zone for each size", async () => {
    const result = await analyser.measure({ ...request, bytes: await solid(1600, 700, "#203040") });
    expect(Object.keys(result.zones)).toEqual(["desktop", "wide"]);
    expect(result.blurDataURL.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(result.dominant[2]).toBeGreaterThan(result.dominant[0]);
    const zones = result.zones.desktop;
    expect(Object.keys(zones ?? {})).toEqual(["eyebrow", "title", "sub", "link", "credit"]);
    expect(zones?.title.brightest).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("measures the light behind the text, not the picture as a whole", async () => {
    // Pale on the right: with the text on the left the zones stay dark, on the right they are pale.
    const bytes = await split(1600, 700);
    const textLeft = await analyser.measure({ ...request, bytes, breakpoints: ["desktop"] });
    const textRight = await analyser.measure({
      ...request,
      bytes,
      textSide: "right",
      breakpoints: ["desktop"],
    });
    // JPEG rounds a channel by a step or two, so compare the lightness, not the exact colour.
    expect(lightness(textLeft.zones.desktop?.title.brightest)).toBeLessThan(40);
    expect(lightness(textRight.zones.desktop?.title.brightest)).toBeGreaterThan(220);
  });

  it("measures a pre-cropped detail of the picture", async () => {
    const bytes = await split(1600, 700);
    const rightHalf = await analyser.measure({
      ...request,
      bytes,
      preCrop: { x: 0.5, y: 0, width: 0.5, height: 1 },
      breakpoints: ["desktop"],
    });
    expect(lightness(rightHalf.zones.desktop?.title.darkest)).toBeGreaterThan(220);
  });

  it("feeds the domain solver: a dark picture needs only the floor, a pale one prefers dark type", async () => {
    const dark = await analyser.measure({ ...request, bytes: await solid(1600, 700, "#1b1d22") });
    const pale = await analyser.measure({ ...request, bytes: await solid(1600, 700, "#f4f1ea") });
    expect(assembleCoverAnalysis(dark, "left").breakpoints.desktop?.recommended).toBe("light");
    expect(assembleCoverAnalysis(pale, "left").breakpoints.desktop?.recommended).toBe("dark");
  });

  it("flattens transparency and rejects a file that is not a picture", async () => {
    const transparent = await sharp({
      create: { width: 400, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const flat = await analyser.measure({
      ...request,
      bytes: transparent,
      breakpoints: ["desktop"],
    });
    expect(flat.zones.desktop?.title.brightest).toBe("#ffffff");
    await expect(
      analyser.measure({ ...request, bytes: Buffer.from("not a picture") }),
    ).rejects.toThrow();
  });
});
