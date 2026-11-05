import { describe, expect, it } from "vitest";
import { hasStoryCover, storyCoverViolation } from "./editorial-story-cover-rule.js";

describe("storyCoverViolation", () => {
  it("lets a draft without a cover be saved", () => {
    expect(
      storyCoverViolation({ coverMediaKey: null, featured: false, published: false }),
    ).toBeNull();
  });

  it("refuses to publish a story without a cover", () => {
    expect(storyCoverViolation({ coverMediaKey: null, featured: false, published: true })).toBe(
      "publish",
    );
  });

  it("refuses to feature a draft without a cover", () => {
    expect(storyCoverViolation({ coverMediaKey: null, featured: true, published: false })).toBe(
      "feature",
    );
  });

  it("treats a blank key as no cover", () => {
    expect(hasStoryCover("  ")).toBe(false);
    expect(hasStoryCover(undefined)).toBe(false);
    expect(storyCoverViolation({ coverMediaKey: "", featured: true, published: true })).toBe(
      "publish",
    );
  });

  it("accepts a published, featured story with a cover", () => {
    expect(
      storyCoverViolation({
        coverMediaKey: "shop/editorial-cover/a.jpg",
        featured: true,
        published: true,
      }),
    ).toBeNull();
  });
});
