import type { Lot } from "@auction/types";
import { describe, expect, it, vi } from "vitest";
import { presentLotsImages } from "./media-presenters.js";

function lot(id: string, images: string[]): Lot {
  return {
    id,
    title: `Lot ${id}`,
    images,
  } as Lot;
}

describe("presentLotsImages batching", () => {
  it("resolves N lots with one lookup and one resolveMany call", async () => {
    const resolveManyUnique = vi.fn(async (keys: string[]) => {
      const map = new Map<string, string>();
      for (const key of keys) map.set(key, `https://cdn.test/${key}`);
      return map;
    });
    const lookupByKeys = vi.fn(async (keys: string[]) => {
      const map = new Map<string, { width: number; height: number; blurDataURL: string }>();
      for (const key of keys) map.set(key, { width: 1, height: 1, blurDataURL: "data:" });
      return map;
    });
    const buildGalleryImagesWithLookup = vi.fn(async () => []);

    const resolver = { resolveManyUnique };
    const enricher = { lookupByKeys, buildGalleryImagesWithLookup };

    await presentLotsImages(
      resolver as never,
      [lot("a", ["k1"]), lot("b", ["k2", "k1"]), lot("c", ["k3"])],
      enricher as never,
    );

    expect(resolveManyUnique).toHaveBeenCalledTimes(1);
    expect(resolveManyUnique.mock.calls[0]?.[0]?.sort()).toEqual(["k1", "k2", "k3"]);
    expect(lookupByKeys).toHaveBeenCalledTimes(1);
    expect(lookupByKeys.mock.calls[0]?.[0]?.sort()).toEqual(["k1", "k2", "k3"]);
  });
});
