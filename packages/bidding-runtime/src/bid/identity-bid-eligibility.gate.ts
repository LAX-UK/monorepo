import type { IBidActorEligibilityReader } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import type { IKycBidGate } from "./kyc-bid.gate.js";
import type { SelfServiceIdentityEligibilityError } from "./self-service-identity-eligibility.error.js";
import { SelfServiceIdentityEligibilityGate } from "./self-service-identity-eligibility.gate.js";

export type { ISelfServiceIdentityEligibilityGate } from "./self-service-identity-eligibility.gate.js";
export { SelfServiceIdentityEligibilityGate } from "./self-service-identity-eligibility.gate.js";
export { SelfServiceIdentityEligibilityError } from "./self-service-identity-eligibility.error.js";

export interface IBidIdentityEligibilityGate {
  assertSelfServiceEligible(userId: string): Promise<Result<void, BidError>>;
  assertValidatedOperatorEligible(userId: string): Promise<Result<void, BidError>>;
}

function toBidError(error: SelfServiceIdentityEligibilityError): BidError {
  return new BidError(error.message, error.status, error.code);
}

export class BidIdentityEligibilityGate implements IBidIdentityEligibilityGate {
  private readonly strictGate: SelfServiceIdentityEligibilityGate;

  constructor(
    actorReader: IBidActorEligibilityReader,
    private readonly thresholdKycGate: IKycBidGate,
    private readonly strictEnabled: boolean,
  ) {
    this.strictGate = new SelfServiceIdentityEligibilityGate(actorReader);
  }

  async assertSelfServiceEligible(userId: string): Promise<Result<void, BidError>> {
    if (!this.strictEnabled) {
      return this.thresholdKycGate.assertCanBid(userId);
    }

    const result = await this.strictGate.assertSelfServiceEligible(userId);
    if (result.isErr()) {
      return err(toBidError(result.error));
    }
    return ok(undefined);
  }

  assertValidatedOperatorEligible(userId: string): Promise<Result<void, BidError>> {
    return this.thresholdKycGate.assertCanBid(userId);
  }
}
