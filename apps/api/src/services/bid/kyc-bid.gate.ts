import { type Result, err, ok } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import type { IKycService } from "../interfaces/kyc-service.js";
import { KycRequiredError } from "../interfaces/kyc-service.js";

export interface IKycBidGate {
  assertCanBid(userId: string): Promise<Result<void, BidError>>;
}

export class KycBidGate implements IKycBidGate {
  constructor(private readonly kycService: IKycService) {}

  async assertCanBid(userId: string): Promise<Result<void, BidError>> {
    try {
      await this.kycService.enforceThreshold(userId);
      return ok(undefined);
    } catch (caught) {
      if (caught instanceof KycRequiredError) {
        return err(
          new BidError("Complete identity verification before bidding", 402, "kyc_required"),
        );
      }
      throw caught;
    }
  }
}

/** Null Object for unconfigured or absent KYC — always permits bidding. */
export class NoOpKycBidGate implements IKycBidGate {
  async assertCanBid(): Promise<Result<void, BidError>> {
    return ok(undefined);
  }
}
