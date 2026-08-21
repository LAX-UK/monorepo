import { buyerEntityCanBid } from "@auction/domain";
import { type Result, err } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import type { IBidEligibility } from "../interfaces/bid-eligibility.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";

export type StandingBidEligibilityInput = {
  bidderId: string;
  buyerLegalEntityId: string;
  ceiling: string;
  autoBidStepAmount: string | null;
};

export interface IStandingBidEligibilityValidator {
  validate(lotId: string, state: StandingBidEligibilityInput): Promise<Result<void, BidError>>;
}

export class StandingBidEligibilityValidator implements IStandingBidEligibilityValidator {
  constructor(
    private readonly bidEligibility: IBidEligibility,
    private readonly legalEntityRepository: ILegalEntityRepository,
  ) {}

  async validate(
    lotId: string,
    state: StandingBidEligibilityInput,
  ): Promise<Result<void, BidError>> {
    try {
      const ceiling = Number.parseFloat(state.ceiling);
      const step =
        state.autoBidStepAmount == null ? null : Number.parseFloat(state.autoBidStepAmount);
      if (!Number.isFinite(ceiling) || ceiling <= 0) {
        return err(new BidError("Invalid standing bid ceiling", 400, "standing_bid_invalid"));
      }
      const eligibility = await this.bidEligibility.assertCanPlaceBid({
        placedByUserId: state.bidderId,
        buyerLegalEntityId: state.buyerLegalEntityId,
        lotId,
        amount: ceiling,
        maxAutoBidAmount: ceiling,
        ...(step != null && Number.isFinite(step) ? { autoBidStepAmount: step } : {}),
        placedVia: "web",
      });
      if (eligibility.isErr()) return eligibility;
      const entity = await this.legalEntityRepository.findById(state.buyerLegalEntityId);
      if (!entity) {
        return err(new BidError("Buyer legal entity not found", 404));
      }
      if (!buyerEntityCanBid(entity.status)) {
        return err(
          new BidError(
            "Buyer legal entity is not authorised to bid",
            403,
            "entity_not_authorised_to_bid",
          ),
        );
      }
      return eligibility;
    } catch {
      return err(
        new BidError(
          "Standing bid eligibility could not be revalidated",
          503,
          "standing_bid_revalidation_failed",
        ),
      );
    }
  }
}
