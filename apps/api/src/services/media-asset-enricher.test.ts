import { describe, expect, it } from "vitest";
import { MediaAssetEnricher } from "./media-asset-enricher.js";

describe("MediaAssetEnricher", () => {
  it("normalizes storage keys from public URLs", async () => {
    const storage = {
      extractKey: (value: string) =>
        value.startsWith("https://cdn.example.com/")
          ? value.slice("https://cdn.example.com/".length)
          : null,
    };
    const enricher = new MediaAssetEnricher({} as never, storage as never);
    const key = (enricher as unknown as { normalizeKey: (v: string) => string }).normalizeKey(
      "https://cdn.example.com/uploads/pending/lots/u/abc.jpg",
    );
    expect(key).toBe("uploads/pending/lots/u/abc.jpg");
  });

  it("degrades to no metadata when the media_asset table is missing (42P01)", async () => {
    const undefinedTable = Object.assign(new Error('relation "media_asset" does not exist'), {
      code: "42P01",
    });
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.reject(undefinedTable),
        }),
      }),
    };
    const enricher = new MediaAssetEnricher(db as never);

    await expect(enricher.lookupByKeys(["uploads/a.jpg"])).resolves.toEqual(new Map());
    await expect(
      enricher.buildGalleryImages(["uploads/a.jpg"], ["https://cdn/a.jpg"]),
    ).resolves.toBeUndefined();
  });

  it("rethrows non-schema database errors", async () => {
    const connectionError = Object.assign(new Error("connection refused"), { code: "08006" });
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.reject(connectionError),
        }),
      }),
    };
    const enricher = new MediaAssetEnricher(db as never);

    await expect(enricher.lookupByKeys(["uploads/a.jpg"])).rejects.toThrow("connection refused");
  });
});
