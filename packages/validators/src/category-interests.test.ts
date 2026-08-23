import { describe, expect, it } from "vitest";
import {
  BUYER_INTEREST_CATEGORY_SEEDS,
  BUYER_INTEREST_CATEGORY_SLUGS,
  categoryInterestsPutSchema,
} from "./category-interests.js";

const categoryId = "11111111-1111-4111-8111-111111111111";

describe("categoryInterestsPutSchema", () => {
  it("accepts ordered unique category IDs and an empty completion", () => {
    expect(categoryInterestsPutSchema.parse({ categoryIds: [categoryId] })).toEqual({
      categoryIds: [categoryId],
    });
    expect(categoryInterestsPutSchema.parse({ categoryIds: [] })).toEqual({ categoryIds: [] });
  });

  it("rejects malformed and duplicate category IDs", () => {
    expect(categoryInterestsPutSchema.safeParse({ categoryIds: ["not-a-uuid"] }).success).toBe(
      false,
    );
    expect(
      categoryInterestsPutSchema.safeParse({ categoryIds: [categoryId, categoryId] }).success,
    ).toBe(false);
  });

  it("caps the request to the documented maximum", () => {
    const categoryIds = Array.from(
      { length: 21 },
      (_, index) => `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`,
    );
    expect(categoryInterestsPutSchema.safeParse({ categoryIds }).success).toBe(false);
  });
});

describe("buyer interest category contract", () => {
  it("defines eight unique stable IDs and slugs", () => {
    const seeds = Object.values(BUYER_INTEREST_CATEGORY_SEEDS);

    expect(seeds).toHaveLength(8);
    expect(new Set(seeds.map(({ id }) => id))).toHaveLength(8);
    expect(new Set(BUYER_INTEREST_CATEGORY_SLUGS)).toHaveLength(8);
    expect(
      seeds.every(({ id }) => categoryInterestsPutSchema.safeParse({ categoryIds: [id] }).success),
    ).toBe(true);
  });
});
