import { REVALIDATABLE_ART_TAGS } from "@/lib/art-cache-tags";
import { describe, expect, it, vi } from "vitest";
import { revalidateArtCache } from "./revalidate-art-cache";

function fakeCache() {
  return { revalidateTag: vi.fn(), revalidatePath: vi.fn() };
}

describe("revalidateArtCache", () => {
  it("purges each data tag without touching a page", () => {
    const cache = fakeCache();
    revalidateArtCache(["art:editorial", "art:artworks", "art:artists"], cache);
    expect(cache.revalidateTag.mock.calls).toEqual([
      ["art:editorial"],
      ["art:artworks"],
      ["art:artists"],
    ]);
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("purges the prerendered home page for the home tag", () => {
    const cache = fakeCache();
    revalidateArtCache(["art:home"], cache);
    expect(cache.revalidateTag).toHaveBeenCalledWith("art:home");
    expect(cache.revalidatePath.mock.calls).toEqual([["/prerendered/home", "page"]]);
  });

  it("accepts every tag shop-api may send", () => {
    // shop-api's invalidator sends these (apps/shop-api/src/infrastructure/http-art-cache-invalidator.ts).
    expect([...REVALIDATABLE_ART_TAGS].sort()).toEqual(
      ["art:artists", "art:artworks", "art:editorial", "art:home"].sort(),
    );
  });
});
