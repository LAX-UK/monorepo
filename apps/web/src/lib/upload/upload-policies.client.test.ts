import { describe, expect, it } from "vitest";
import {
  catalogImageAccept,
  catalogImageHelperCopy,
  getCatalogImagePolicy,
} from "./upload-policies.client";

describe("upload-policies.client", () => {
  it("mirrors admin image MIME restrictions without GIF", () => {
    expect(catalogImageAccept("lot_image")).toBe("image/jpeg,image/png,image/webp");
    expect(catalogImageAccept("sale_day")).toContain("video/mp4");
    expect(getCatalogImagePolicy("avatar").maxBytes).toBe(2 * 1024 * 1024);
    expect(getCatalogImagePolicy("lot_image").maxBytes).toBe(10 * 1024 * 1024);
    expect(getCatalogImagePolicy("sale_day").maxBytes).toBe(200 * 1024 * 1024);
  });

  it("returns helper copy with optional remaining count", () => {
    expect(getCatalogImagePolicy("category_image").placeholderLabel).toBe("Category hero");
    expect(catalogImageHelperCopy("lot_image", 3)).toContain("3 remaining");
  });
});
