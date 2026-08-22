import { err, ok } from "neverthrow";
import { describe, expect, it, vi } from "vitest";
import { BidError } from "../bid-error.js";
import type { IBidActorEligibilityReader } from "../ports.js";
import { BidIdentityEligibilityGate } from "./identity-bid-eligibility.gate.js";
import type { IKycBidGate } from "./kyc-bid.gate.js";

function thresholdGate(result = ok(undefined)): IKycBidGate {
  return { assertCanBid: vi.fn().mockResolvedValue(result) };
}

describe("BidIdentityEligibilityGate", () => {
  it("checks email before KYC for strict self-service bidding", async () => {
    const threshold = thresholdGate(
      err(new BidError("Complete identity verification before bidding", 402, "kyc_required")),
    );
    const gate = new BidIdentityEligibilityGate(
      {
        findBidActorEligibility: vi
          .fn()
          .mockResolvedValue({ emailVerified: false, kycStatus: "unverified" }),
      },
      threshold,
      true,
    );

    const result = await gate.assertSelfServiceEligible("user-1");

    expect(result.isErr() && [result.error.status, result.error.code]).toEqual([
      403,
      "email_not_verified",
    ]);
    expect(threshold.assertCanBid).not.toHaveBeenCalled();
  });

  it("uses threshold KYC for validated operators even when strict is enabled", async () => {
    const findBidActorEligibility = vi.fn();
    const threshold = thresholdGate(
      err(new BidError("Complete identity verification before bidding", 402, "kyc_required")),
    );
    const gate = new BidIdentityEligibilityGate(
      { findBidActorEligibility } as IBidActorEligibilityReader,
      threshold,
      true,
    );

    const result = await gate.assertValidatedOperatorEligible("user-1");

    expect(result.isErr() && result.error.code).toBe("kyc_required");
    expect(threshold.assertCanBid).toHaveBeenCalledWith("user-1");
    expect(findBidActorEligibility).not.toHaveBeenCalled();
  });

  it("preserves threshold KYC for self-service when strict is disabled", async () => {
    const findBidActorEligibility = vi.fn();
    const threshold = thresholdGate();
    const gate = new BidIdentityEligibilityGate(
      { findBidActorEligibility } as IBidActorEligibilityReader,
      threshold,
      false,
    );

    expect((await gate.assertSelfServiceEligible("user-1")).isOk()).toBe(true);
    expect(threshold.assertCanBid).toHaveBeenCalledWith("user-1");
    expect(findBidActorEligibility).not.toHaveBeenCalled();
  });

  it("fails closed when a strict self-service actor is missing", async () => {
    const gate = new BidIdentityEligibilityGate(
      { findBidActorEligibility: vi.fn().mockResolvedValue(null) },
      thresholdGate(),
      true,
    );

    const result = await gate.assertSelfServiceEligible("missing");

    expect(result.isErr() && result.error.code).toBe("kyc_required");
  });
});
