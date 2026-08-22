import type { Database } from "@auction/db";
import type { Result } from "neverthrow";
import { createBidEligibility } from "../container/create-bid-eligibility.js";
import type { BidError } from "../lib/errors.js";
import type { IAmlHoldStore } from "./aml/ports.js";
import type { BidEligibilityCheckInput, IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { IKycService } from "./interfaces/kyc-service.js";

/** Compatibility facade; the shared runtime implementation owns the seven collaborators. */
export class BidEligibilityService implements IBidEligibility {
  private readonly inner: IBidEligibility;

  constructor(
    db: Database,
    kycService: IKycService | null = null,
    amlHoldStore: IAmlHoldStore | null = null,
    strictEnabled = false,
  ) {
    this.inner = createBidEligibility({
      db,
      kycService,
      amlHoldStore: amlHoldStore ?? {
        getHold: async () => null,
        setHold: async () => {},
        clearHold: async () => {},
      },
      strictEnabled,
    });
  }

  async assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>> {
    return this.inner.assertCanPlaceBid(input);
  }
}
