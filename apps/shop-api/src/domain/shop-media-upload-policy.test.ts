import { describe, expect, it } from "vitest";
import {
  buildShopMediaObjectKey,
  matchesDeclaredImageType,
  shopMediaPolicy,
} from "./shop-media-upload-policy.js";

describe("shopMediaPolicy", () => {
  it("allows webp for artwork images within 10MB", () => {
    const policy = shopMediaPolicy("artwork_image");
    expect(policy.allowedContentTypes).toContain("image/webp");
    expect(policy.maxBytes).toBe(10 * 1024 * 1024);
    expect(buildShopMediaObjectKey("artwork_image", "image/webp")).toMatch(
      /^shop\/artwork\/[0-9a-f-]+\.webp$/,
    );
  });

  it("rejects unknown magic bytes", () => {
    expect(matchesDeclaredImageType("image/png", Buffer.from("not-a-png"))).toBe(false);
  });

  it("accepts PNG magic header", () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
    ]);
    expect(matchesDeclaredImageType("image/png", png)).toBe(true);
  });
});
