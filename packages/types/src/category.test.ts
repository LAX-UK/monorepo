import { describe, expect, it } from "vitest";
import { emptyCategoryUsage, withCategoryUsageTotal } from "./category.js";

describe("withCategoryUsageTotal", () => {
  it("includes buyer interests in the delete-blocking total", () => {
    expect(withCategoryUsageTotal({ lots: 0, sales: 0, submissions: 0, interests: 4 })).toEqual({
      lots: 0,
      sales: 0,
      submissions: 0,
      interests: 4,
      total: 4,
    });
  });

  it("sums every usage source", () => {
    expect(withCategoryUsageTotal({ lots: 1, sales: 2, submissions: 3, interests: 4 }).total).toBe(
      10,
    );
    expect(emptyCategoryUsage().total).toBe(0);
  });
});
