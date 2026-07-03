import { describe, expect, it, vi } from "vitest";
import { MediaAssetEnricher } from "./media-asset-enricher.js";

describe("MediaAssetEnricher", () => {
  it("normalizes storage keys from public URLs", async () => {
    const storage = {
      extractKey: (value: string) =>
        value.startsWith("https://cdn.example.com/")
          ? value.slice("https://cdn.example.com/".length)
          : null,
    };
    const enricher = new MediaAssetEnricher({ lookupByKeys: vi.fn() } as never, storage as never);
    const key = (enricher as unknown as { normalizeKey: (v: string) => string }).normalizeKey(
      "https://cdn.example.com/uploads/pending/lots/u/abc.jpg",
    );
    expect(key).toBe("uploads/pending/lots/u/abc.jpg");
  });

  it("degrades to no metadata when the media_asset table is missing (42P01)", async () => {
    const mediaAssetReader = {
      lookupByKeys: vi.fn().mockResolvedValue(new Map()),
    };
    const enricher = new MediaAssetEnricher(mediaAssetReader as never);

    await expect(enricher.lookupByKeys(["uploads/a.jpg"])).resolves.toEqual(new Map());
    await expect(
      enricher.buildGalleryImages(["uploads/a.jpg"], ["https://cdn/a.jpg"]),
    ).resolves.toBeUndefined();
  });

  it("rethrows non-schema database errors", async () => {
    const connectionError = Object.assign(new Error("connection refused"), { code: "08006" });
    const mediaAssetReader = {
      lookupByKeys: vi.fn().mockRejectedValue(connectionError),
    };
    const enricher = new MediaAssetEnricher(mediaAssetReader as never);

    await expect(enricher.lookupByKeys(["uploads/a.jpg"])).rejects.toThrow("connection refused");
  });
});
