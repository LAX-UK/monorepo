import type { ZohoImageSource } from "@auction/artwork-register-contracts";
import { describe, expect, it } from "vitest";
import { MAX_IMAGES_PER_ARTWORK, planImageSync } from "./plan-image-sync.js";
import type { RemoteProductImage } from "./zoho-product-image.js";

const remote = (fileId: string, fingerprint = "f1"): RemoteProductImage => ({
  fileId,
  fingerprint,
  origin: fileId === "record_image" ? "record_image" : "attachment",
  fileName: null,
});
const copied = (zohoFileId: string, fingerprint = "f1"): ZohoImageSource => ({
  zohoFileId,
  fingerprint,
  sha256: "b".repeat(64),
  key: `shop/artwork/zoho-${zohoFileId}.jpg`,
});

describe("planImageSync", () => {
  it("fetches everything for a record with no pictures yet, in Zoho's order", () => {
    const plan = planImageSync([remote("record_image"), remote("a1"), remote("a2")], []);
    expect(plan.items.map((i) => [i.image.fileId, i.copied])).toEqual([
      ["record_image", null],
      ["a1", null],
      ["a2", null],
    ]);
    expect(plan).toMatchObject({ ignored: 0, removed: 0 });
  });

  it("reuses a picture whose Zoho file and fingerprint are unchanged", () => {
    const plan = planImageSync([remote("a1")], [copied("a1")]);
    expect(plan.items[0]?.copied).toEqual(copied("a1"));
  });

  it("fetches a picture again when Zoho's file changed", () => {
    const plan = planImageSync([remote("a1", "f2")], [copied("a1", "f1")]);
    expect(plan.items[0]?.copied).toBeNull();
    expect(plan.removed).toBe(0);
  });

  it("follows Zoho's new order without fetching anything that did not change", () => {
    const plan = planImageSync([remote("a2"), remote("a1")], [copied("a1"), copied("a2")]);
    expect(plan.items.map((i) => i.image.fileId)).toEqual(["a2", "a1"]);
    expect(plan.items.every((i) => i.copied)).toBe(true);
  });

  it("counts pictures Zoho no longer lists", () => {
    const plan = planImageSync([remote("a1")], [copied("a1"), copied("gone")]);
    expect(plan.removed).toBe(1);
  });

  it("plans an empty list when Zoho has none, removing what the register held", () => {
    expect(planImageSync([], [copied("a1")])).toMatchObject({ items: [], removed: 1 });
  });

  it("keeps only the first pictures up to the limit and counts the rest", () => {
    const many = Array.from({ length: MAX_IMAGES_PER_ARTWORK + 3 }, (_, i) => remote(`a${i}`));
    const plan = planImageSync(many, []);
    expect(plan.items).toHaveLength(MAX_IMAGES_PER_ARTWORK);
    expect(plan.ignored).toBe(3);
  });
});
