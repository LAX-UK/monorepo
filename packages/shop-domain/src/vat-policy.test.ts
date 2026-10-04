import { describe, expect, it } from "vitest";
import { computeLineVat } from "./vat-policy.js";

describe("computeLineVat", () => {
  it("computes VAT on line net amount", () => {
    const result = computeLineVat(
      { standardRateBp: 2000 },
      { unitPricePence: 10_000, quantity: 1 },
    );
    expect(result).toEqual({
      ok: true,
      vatTreatment: "standard",
      vatRateBp: 2000,
      vatPence: 2000,
    });
  });

  it("returns not configured when policy is missing", () => {
    expect(computeLineVat(null, { unitPricePence: 100 })).toEqual({
      ok: false,
      reason: "policy_not_configured",
    });
  });
});
