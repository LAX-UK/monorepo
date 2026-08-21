import {
  recommendationCategoryIds,
  uniqueRecommendationRows,
} from "@/lib/onboarding/buyer-recommendations";
import { describe, expect, it } from "vitest";

describe("buyer recommendations policy", () => {
  it("keeps selected known categories in user order and excludes conditional categories", () => {
    const categories = [
      { id: "paintings", slug: "paintings" },
      { id: "other", slug: "mixed-media" },
      { id: "watches", slug: "watches-clocks" },
    ];
    expect(
      recommendationCategoryIds(
        ["watches", "unknown", "other", "paintings"],
        categories,
        new Set(["mixed-media"]),
      ),
    ).toEqual(["watches", "paintings"]);
  });

  it("deduplicates cross-category lots before applying the recommendation limit", () => {
    expect(
      uniqueRecommendationRows([
        { id: "lot-1", category: "paintings" },
        { id: "lot-1", category: "mixed" },
        { id: "lot-2", category: "watches" },
        { id: "lot-3", category: "coins" },
        { id: "lot-4", category: "sculpture" },
      ]),
    ).toEqual([
      { id: "lot-1", category: "paintings" },
      { id: "lot-2", category: "watches" },
      { id: "lot-3", category: "coins" },
    ]);
  });
});
