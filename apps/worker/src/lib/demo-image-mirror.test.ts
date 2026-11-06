import type { DemoImageEntry } from "@auction/db";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { mirrorDemoPicture, mirrorDemoPictures, resizeDemoPicture } from "./demo-image-mirror.js";

const entry: DemoImageEntry = {
  source: "https://images.metmuseum.org/CRDImages/ep/original/a.jpg",
  kind: "lot",
  key: "demo/lot/a-12345678.jpg",
  longEdge: 1600,
  licence: "CC0",
  provider: "The Met Open Access",
};

function storage(stored: { byteSize: number } | null) {
  return {
    headObject: vi.fn(async () =>
      stored ? { contentType: "image/jpeg", byteSize: stored.byteSize, etag: "x" } : null,
    ),
    putObject: vi.fn(async (key: string) => ({ url: `https://cdn/${key}` })),
  };
}

const deps = (s: ReturnType<typeof storage>) => ({
  storage: s,
  fetchPicture: async () => Buffer.from("original"),
  resize: async () => Buffer.alloc(100),
});

describe("mirrorDemoPicture", () => {
  it("uploads a missing copy as a jpeg", async () => {
    const s = storage(null);
    expect(await mirrorDemoPicture(entry, deps(s))).toEqual({
      key: entry.key,
      status: "uploaded",
      bytes: 100,
    });
    expect(s.putObject).toHaveBeenCalledWith(entry.key, expect.any(Buffer), "image/jpeg");
  });

  it("skips a copy that is already stored at the same size", async () => {
    const s = storage({ byteSize: 100 });
    expect((await mirrorDemoPicture(entry, deps(s))).status).toBe("unchanged");
    expect(s.putObject).not.toHaveBeenCalled();
  });

  it("replaces a copy stored at a different size", async () => {
    const s = storage({ byteSize: 99 });
    expect((await mirrorDemoPicture(entry, deps(s))).status).toBe("uploaded");
  });

  it("reports a failed download and carries on with the rest", async () => {
    const s = storage(null);
    const failing = { ...deps(s), fetchPicture: vi.fn().mockRejectedValueOnce(new Error("gone")) };
    failing.fetchPicture.mockResolvedValue(Buffer.from("ok"));
    const outcomes = await mirrorDemoPictures(
      [entry, { ...entry, key: "demo/lot/b.jpg" }],
      failing,
    );
    expect(outcomes.map((o) => o.status)).toEqual(["failed", "uploaded"]);
  });
});

describe("resizeDemoPicture", () => {
  it("shrinks the long edge, never enlarges, and writes a progressive jpeg", async () => {
    const big = await sharp({
      create: { width: 3000, height: 2000, channels: 3, background: "#884422" },
    })
      .png()
      .toBuffer();
    const out = await sharp(await resizeDemoPicture(big, 1600)).metadata();
    expect(out.width).toBe(1600);
    expect(out.height).toBe(1067);
    expect(out.format).toBe("jpeg");
    expect(out.isProgressive).toBe(true);

    const small = await sharp({
      create: { width: 400, height: 300, channels: 3, background: "#224488" },
    })
      .png()
      .toBuffer();
    expect((await sharp(await resizeDemoPicture(small, 1600)).metadata()).width).toBe(400);
  });
});
