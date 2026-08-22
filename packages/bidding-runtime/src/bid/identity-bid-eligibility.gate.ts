import { evaluateSelfServiceActorBidEligibility } from "@auction/domain";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import type { IBidActorEligibilityReader } from "../ports.js";
import type { IKycBidGate } from "./kyc-bid.gate.js";

export interface IBidIdentityEligibilityGate {
  assertSelfServiceEligible(userId: string): Promise<Result<void, BidError>>;
  assertValidatedOperatorEligible(userId: string): Promise<Result<void, BidError>>;
}

export class BidIdentityEligibilityGate implements IBidIdentityEligibilityGate {
  constructor(
    private readonly actorReader: IBidActorEligibilityReader,
    private readonly thresholdKycGate: IKycBidGate,
    private readonly strictEnabled: boolean,
  ) {}

  async assertSelfServiceEligible(userId: string): Promise<Result<void, BidError>> {
    if (!this.strictEnabled) {
      return this.thresholdKycGate.assertCanBid(userId);
    }

    const actor = await this.actorReader.findBidActorEligibility(userId);
    const outcome = actor
      ? evaluateSelfServiceActorBidEligibility(actor)
      : { kind: "ineligible" as const, code: "kyc_required" as const };

    if (outcome.kind === "eligible") return ok(undefined);
    if (outcome.code === "email_not_verified") {
      return err(new BidError("Verify your email before bidding", 403, outcome.code));
    }
    return err(new BidError("Complete identity verification before bidding", 402, outcome.code));
  }

  assertValidatedOperatorEligible(userId: string): Promise<Result<void, BidError>> {
    return this.thresholdKycGate.assertCanBid(userId);
  }
}
