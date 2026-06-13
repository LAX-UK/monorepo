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
});
