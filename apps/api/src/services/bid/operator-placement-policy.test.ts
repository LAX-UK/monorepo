import { describe, expect, it } from "vitest";
import { OperatorPlacementPolicy } from "./operator-placement-policy.js";

describe("OperatorPlacementPolicy", () => {
  const policy = new OperatorPlacementPolicy({} as never);

  it("bypasses sale registration for telephone and saleroom", () => {
    expect(policy.bypassChecks("telephone")).toEqual({
      saleRegistration: true,
      buyerAgentAuth: true,
    });
    expect(policy.bypassChecks("saleroom")).toEqual({
      saleRegistration: true,
      buyerAgentAuth: true,
    });
    expect(policy.bypassChecks("web")).toEqual({
      saleRegistration: false,
      buyerAgentAuth: false,
    });
  });

  it("rejects bids above cap", () => {
    expect(() => policy.assertCapNotExceeded(5000, 5001)).toThrow();
  });
});
