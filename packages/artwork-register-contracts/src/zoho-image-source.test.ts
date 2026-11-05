import { describe, expect, it } from "vitest";
import { type ZohoImageSource, imageKeysOf, sameImageSources } from "./zoho-image-source.js";

const source = (id: string, key = `shop/artwork/zoho-${id}.jpg`): ZohoImageSource => ({
  zohoFileId: id,
  fingerprint: "1:2",
  sha256: "a".repeat(64),
  key,
});

describe("imageKeysOf", () => {
  it("keeps Zoho's order, so the first key is the cover", () => {
    expect(imageKeysOf([source("b"), source("a")])).toEqual([
      "shop/artwork/zoho-b.jpg",
      "shop/artwork/zoho-a.jpg",
    ]);
  });

  it("lists a picture once when two Zoho files hold the same content", () => {
    const same = "shop/artwork/zoho-same.jpg";
    expect(imageKeysOf([source("a", same), source("b", same), source("c")])).toEqual([
      same,
      "shop/artwork/zoho-c.jpg",
    ]);
  });
});

describe("sameImageSources", () => {
  it("is true for equal lists and false for any difference in order or content", () => {
    expect(sameImageSources([source("a"), source("b")], [source("a"), source("b")])).toBe(true);
    expect(sameImageSources([source("a"), source("b")], [source("b"), source("a")])).toBe(false);
    expect(sameImageSources([source("a")], [{ ...source("a"), fingerprint: "9:9" }])).toBe(false);
    expect(sameImageSources([source("a")], [])).toBe(false);
  });
});
