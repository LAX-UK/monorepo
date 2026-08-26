import type { ILegalEntityRepository } from "@auction/persistence/interfaces";
import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../bid-error.js";
import type { IBidEligibility } from "../ports.js";
import { StandingBidEligibilityValidator } from "./standing-bid-eligibility.validator.js";

const state = {
  bidderId: "user-1",
  buyerLegalEntityId: "entity-1",
  ceiling: "500.00",
  autoBidStepAmount: "10.00",
};

function legalEntities(status: string): ILegalEntityRepository {
  return {
    findById: vi.fn().mockResolvedValue({ status }),
  } as unknown as ILegalEntityRepository;
}

describe("StandingBidEligibilityValidator", () => {
  it("rejects an entity that is no longer authorised to buy after actor eligibility", async () => {
    const assertCanPlaceBid = vi.fn().mockResolvedValue(ok(undefined));
    const validator = new StandingBidEligibilityValidator(
      { assertCanPlaceBid } as IBidEligibility,
      legalEntities("rejected"),
    );

    const result = await validator.validate("lot-1", state);

    expect(result.isErr() && result.error.code).toBe("entity_not_authorised_to_bid");
    expect(assertCanPlaceBid).toHaveBeenCalled();
  });

  it("returns 404 when buyer legal entity is missing after actor eligibility", async () => {
    const validator = new StandingBidEligibilityValidator(
      { assertCanPlaceBid: vi.fn().mockResolvedValue(ok(undefined)) } as IBidEligibility,
      {
        findById: vi.fn().mockResolvedValue(null),
      } as unknown as ILegalEntityRepository,
    );

    const result = await validator.validate("lot-1", state);

    expect(result.isErr() && result.error.status).toBe(404);
    expect(result.isErr() && result.error.message).toBe("Buyer legal entity not found");
  });

  it("returns actor identity errors before entity status", async () => {
    const assertCanPlaceBid = vi
      .fn()
      .mockResolvedValue(
        err(new BidError("Verify your email before bidding", 403, "email_not_verified")),
      );
    const findById = vi.fn();
    const validator = new StandingBidEligibilityValidator(
      { assertCanPlaceBid } as IBidEligibility,
      { findById } as unknown as ILegalEntityRepository,
    );

    const result = await validator.validate("lot-1", state);

    expect(result.isErr() && result.error.code).toBe("email_not_verified");
    expect(findById).not.toHaveBeenCalled();
  });

  it.each([
    "membership_required",
    "sale_registration_required",
    "buyer_agent_authorisation_required",
  ])("propagates full standing-bid revalidation failure %s", async (code) => {
    const assertCanPlaceBid = vi
      .fn()
      .mockResolvedValue(err(new BidError("Standing bid no longer eligible", 403, code)));
    const validator = new StandingBidEligibilityValidator(
      { assertCanPlaceBid } as IBidEligibility,
      legalEntities("approved"),
    );

    const result = await validator.validate("lot-1", state);

    expect(result.isErr() && result.error.code).toBe(code);
    expect(assertCanPlaceBid).toHaveBeenCalledWith({
      placedByUserId: "user-1",
      buyerLegalEntityId: "entity-1",
      lotId: "lot-1",
      amount: 500,
      maxAutoBidAmount: 500,
      autoBidStepAmount: 10,
      placedVia: "web",
    });
  });

  it("converts read failures into a transient 503 that must not cancel", async () => {
    const validator = new StandingBidEligibilityValidator(
      { assertCanPlaceBid: vi.fn().mockResolvedValue(ok(undefined)) },
      {
        findById: vi.fn().mockRejectedValue(new Error("database unavailable")),
      } as unknown as ILegalEntityRepository,
    );

    const result = await validator.validate("lot-1", state);

    expect(result.isErr() && result.error.code).toBe("standing_bid_revalidation_failed");
  });
});
