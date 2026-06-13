import { describe, expect, it } from "vitest";
import { SharpImageProcessor } from "./sharp-image-processor.js";

/** Minimal 1×1 red PNG. */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("SharpImageProcessor", () => {
  const processor = new SharpImageProcessor();

  it("reads image dimensions", async () => {
    const dims = await processor.analyze(TINY_PNG);
    expect(dims.width).toBe(1);
    expect(dims.height).toBe(1);
  });

  it("generates a blur data URL", async () => {
    const blur = await processor.makeLqip(TINY_PNG);
    expect(blur.startsWith("data:image/webp;base64,")).toBe(true);
    expect(blur.length).toBeGreaterThan(30);
  });
});
