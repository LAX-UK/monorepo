import type { IOperatorPlacementReader } from "@auction/persistence/interfaces";
import { describe, expect, it, vi } from "vitest";
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

  it("binds telephone bypass to the booking owner and acting entity", async () => {
    vi.mocked(reader.findTelephoneBookingPlacement).mockResolvedValue({
      saleId: "sale-1",
      status: "confirmed",
      userId: "user-1",
      buyerLegalEntityId: "entity-1",
    });

    await expect(
      policy.isActiveTelephoneBooking("booking-1", "sale-1", "user-1", "entity-1"),
    ).resolves.toBe(true);
    await expect(
      policy.isActiveTelephoneBooking("booking-1", "sale-1", "other-user", "entity-1"),
    ).resolves.toBe(false);
    await expect(
      policy.isActiveTelephoneBooking("booking-1", "sale-1", "user-1", "other-entity"),
    ).resolves.toBe(false);
  });
});
