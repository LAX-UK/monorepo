import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../../lib/errors.js";
import type { IBidEligibility } from "../interfaces/bid-eligibility.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import { StandingBidEligibilityValidator } from "./standing-bid-eligibility.validator.js";

const state = {
  bidderId: "user-1",
  buyerLegalEntityId: "entity-1",
  ceiling: "500.00",
  autoBidStepAmount: "10.00",
};

describe("StandingBidEligibilityValidator", () => {
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

  it("rejects an entity that is no longer authorised after actor eligibility", async () => {
    const validator = new StandingBidEligibilityValidator(
      { assertCanPlaceBid: vi.fn().mockResolvedValue(ok(undefined)) } as IBidEligibility,
      {
        findById: vi.fn().mockResolvedValue({ status: "rejected" }),
      } as unknown as ILegalEntityRepository,
    );

    const result = await validator.validate("lot-1", state);

    expect(result.isErr() && result.error.code).toBe("entity_not_authorised_to_bid");
  });
});
