import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidEligibilityService } from "./bid-eligibility.service.js";
import { BidError } from "./bid-error.js";
import { OperatorPlacementPolicy } from "./bid/operator-placement-policy.js";

function buildService(input: {
  entityExists?: boolean;
  booking?: {
    saleId: string;
    status: string;
    userId: string;
    buyerLegalEntityId: string;
  } | null;
  selfServiceEligible?: boolean;
}) {
  const assertSelfServiceEligible = vi
    .fn()
    .mockResolvedValue(
      input.selfServiceEligible
        ? ok(undefined)
        : err(new BidError("Verify your email", 403, "email_not_verified")),
    );
  const assertValidatedOperatorEligible = vi.fn().mockResolvedValue(ok(undefined));
  const findBuyerEntityMembership = vi.fn().mockResolvedValue({
    entityExists: input.entityExists ?? true,
    memberRole: "owner",
  });
  const saleRegistrationGate = { assertCanBid: vi.fn().mockResolvedValue(ok(undefined)) };
  const buyerAgentGate = { assertCanBid: vi.fn().mockResolvedValue(ok(undefined)) };
  const service = new BidEligibilityService(
    {
      assertSelfServiceEligible,
      assertValidatedOperatorEligible,
    },
    { assertCanBid: vi.fn().mockResolvedValue(ok(undefined)) },
    {
      findLotBidRules: vi.fn().mockResolvedValue({
        saleId: "sale-1",
        autoBidEnabled: true,
        minBidIncrement: "10.00",
        autoBidStepMin: null,
        autoBidStepMax: null,
        autoBidStepPresets: null,
      }),
    },
    {
      findBuyerEntityMembership,
    },
    new OperatorPlacementPolicy({
      findTelephoneBookingPlacement: vi.fn().mockResolvedValue(input.booking ?? null),
      findTelephoneBookingCap: vi.fn().mockResolvedValue({ reserveAltMax: null }),
      findPaddleRegistration: vi.fn(),
    }),
    saleRegistrationGate,
    buyerAgentGate,
  );
  return {
    service,
    assertSelfServiceEligible,
    assertValidatedOperatorEligible,
    findBuyerEntityMembership,
    saleRegistrationGate,
  };
}

describe("BidEligibilityService", () => {
  it("returns 404 before membership when the buyer legal entity is missing", async () => {
    const { service, findBuyerEntityMembership } = buildService({
      entityExists: false,
      selfServiceEligible: true,
    });

    const result = await service.assertCanPlaceBid({
      placedByUserId: "buyer-1",
      buyerLegalEntityId: "missing-entity",
      lotId: "lot-1",
      amount: 100,
    });

    expect(result.isErr() && result.error.status).toBe(404);
    expect(findBuyerEntityMembership).toHaveBeenCalledWith("buyer-1", "missing-entity");
  });

  it("does not grant operator bypass when the booking belongs to another buyer", async () => {
    const { service, assertSelfServiceEligible, assertValidatedOperatorEligible } = buildService({
      booking: {
        saleId: "sale-1",
        status: "confirmed",
        userId: "booking-owner",
        buyerLegalEntityId: "booking-entity",
      },
    });

    const result = await service.assertCanPlaceBid({
      placedByUserId: "buyer-1",
      buyerLegalEntityId: "buyer-entity",
      lotId: "lot-1",
      amount: 100,
      placedVia: "telephone",
      telephoneBookingId: "booking-1",
    });

    expect(result.isErr() && result.error.code).toBe("email_not_verified");
    expect(assertSelfServiceEligible).toHaveBeenCalledWith("buyer-1");
    expect(assertValidatedOperatorEligible).not.toHaveBeenCalled();
  });
});
