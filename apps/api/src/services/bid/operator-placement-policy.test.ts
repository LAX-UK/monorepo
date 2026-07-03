import { describe, expect, it, vi } from "vitest";
import type { IOperatorPlacementReader } from "../../repositories/interfaces/operator-placement.reader.js";
import { OperatorPlacementPolicy } from "./operator-placement-policy.js";

describe("OperatorPlacementPolicy", () => {
  const reader: IOperatorPlacementReader = {
    findTelephoneBookingPlacement: vi.fn(),
    findTelephoneBookingCap: vi.fn(),
    findPaddleRegistration: vi.fn(),
  };
  const policy = new OperatorPlacementPolicy(reader);

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
