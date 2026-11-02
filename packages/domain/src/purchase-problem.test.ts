import { describe, expect, it } from "vitest";
import { purchaseProblemReference } from "./purchase-problem.js";

describe("purchaseProblemReference", () => {
  it("is the first eight characters of the case id, upper-cased", () => {
    expect(purchaseProblemReference("3f2a9c1e-7b4d-4e0a-9d1f-5c6b7a8e9f00")).toBe("PR-3F2A9C1E");
  });
});
