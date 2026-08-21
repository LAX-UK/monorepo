import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import type { IKycThresholdGate } from "../ports.js";

export interface IKycBidGate {
  assertCanBid(userId: string): Promise<Result<void, BidError>>;
}

function isKycRequiredError(caught: unknown): boolean {
  return (
    typeof caught === "object" &&
    caught !== null &&
    (caught as { code?: unknown }).code === "kyc_required"
  );
}

export class KycBidGate implements IKycBidGate {
  constructor(private readonly kycService: IKycThresholdGate) {}

  async assertCanBid(userId: string): Promise<Result<void, BidError>> {
    try {
      await this.kycService.enforceThreshold(userId);
      return ok(undefined);
    } catch (caught) {
      if (isKycRequiredError(caught)) {
        return err(
          new BidError("Complete identity verification before bidding", 402, "kyc_required"),
        );
      }
      throw caught;
    }
  }
}

export class NoOpKycBidGate implements IKycBidGate {
  async assertCanBid(): Promise<Result<void, BidError>> {
    return ok(undefined);
  }
}
