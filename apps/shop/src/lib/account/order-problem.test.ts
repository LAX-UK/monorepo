import { describe, expect, it } from "vitest";
import { orderedOrderProblemErrors, validateOrderProblem } from "./order-problem";

describe("validateOrderProblem", () => {
  it("asks for a reason and what happened", () => {
    const errors = validateOrderProblem({ reason: "", details: "   " });
    expect(errors).toEqual({
      reason: "Choose what went wrong",
      details: "Tell us what happened",
    });
    expect(orderedOrderProblemErrors(errors)).toEqual([
      { fieldId: "problem-reason", message: "Choose what went wrong" },
      { fieldId: "problem-details", message: "Tell us what happened" },
    ]);
  });

  it("accepts a complete report and refuses one that is too long", () => {
    expect(validateOrderProblem({ reason: "damaged", details: "The corner is creased." })).toEqual(
      {},
    );
    expect(validateOrderProblem({ reason: "other", details: "x".repeat(2001) }).details).toBe(
      "Keep it to 2,000 characters or fewer",
    );
  });
});
