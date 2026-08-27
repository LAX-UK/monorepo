import { evaluateSelfServiceActorIdentityEligibility } from "@auction/domain";
import type { IBidActorEligibilityReader } from "@auction/persistence/interfaces";
import { type Result, err, ok } from "neverthrow";
import { SelfServiceIdentityEligibilityError } from "./self-service-identity-eligibility.error.js";

export interface ISelfServiceIdentityEligibilityGate {
  assertSelfServiceEligible(
    userId: string,
  ): Promise<Result<void, SelfServiceIdentityEligibilityError>>;
}

export class SelfServiceIdentityEligibilityGate implements ISelfServiceIdentityEligibilityGate {
  constructor(private readonly actorReader: IBidActorEligibilityReader) {}

  async assertSelfServiceEligible(
    userId: string,
  ): Promise<Result<void, SelfServiceIdentityEligibilityError>> {
    const actor = await this.actorReader.findBidActorEligibility(userId);
    const outcome = actor
      ? evaluateSelfServiceActorIdentityEligibility(actor)
      : { kind: "ineligible" as const, code: "kyc_required" as const };

    if (outcome.kind === "eligible") return ok(undefined);
    if (outcome.code === "email_not_verified") {
      return err(
        new SelfServiceIdentityEligibilityError(
          "Verify your email before bidding",
          403,
          outcome.code,
        ),
      );
    }
    return err(
      new SelfServiceIdentityEligibilityError(
        "Complete identity verification before bidding",
        402,
        outcome.code,
      ),
    );
  }
}
