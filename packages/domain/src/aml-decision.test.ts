import { describe, expect, it } from "vitest";
import { evaluateAmlScreeningResult } from "./aml-decision.js";

describe("evaluateAmlScreeningResult", () => {
  it("clears when there is no match and no hits", () => {
    const decision = evaluateAmlScreeningResult({
      matchStatus: "no_match",
      categories: [],
      totalHits: 0,
    });
    expect(decision.outcome).toBe("clear");
  });

  it("blocks confirmed sanctions matches", () => {
    const decision = evaluateAmlScreeningResult({
      matchStatus: "confirmed_match",
      categories: ["sanction"],
      totalHits: 1,
    });
    expect(decision.outcome).toBe("block");
  });

  it("reviews possible matches", () => {
    const decision = evaluateAmlScreeningResult({
      matchStatus: "possible_match",
      categories: ["adverse_media"],
      totalHits: 3,
    });
    expect(decision.outcome).toBe("review");
  });
});
