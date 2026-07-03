import { saleModeAllowsBidding } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { buyerEntityCanBid } from "../../lib/buyer-entity-bid-eligibility.js";
import { BidError } from "../../lib/errors.js";
import { isOperatorPlacement } from "../interfaces/auction-strategy.js";
import type { IBidEligibility } from "../interfaces/bid-eligibility.js";
import type { ILegalEntityRepository } from "../interfaces/legal-entity-repository.js";
import type { PlaceBidInput } from "../interfaces/place-bid.js";
import type { ISaleModeLookup } from "../interfaces/sale-mode-lookup.js";

export class BidPrePlacementValidator {
  constructor(
    private readonly saleModeLookup: ISaleModeLookup | null,
    private readonly legalEntityRepository: ILegalEntityRepository | null,
    private readonly bidEligibility: IBidEligibility | null,
  ) {}

  async validate(input: PlaceBidInput): Promise<Result<void, BidError>> {
    const {
      placedByUserId,
      buyerLegalEntityId,
      lotId,
      amount,
      maxAutoBidAmount,
      autoBidStepAmount,
      placement: bidPlacement,
    } = input;

    if (this.saleModeLookup) {
      const saleMode = await this.saleModeLookup.findSaleModeForLot(lotId);
      const placedVia = bidPlacement?.placedVia ?? null;
      if (saleMode && !saleModeAllowsBidding(saleMode) && !isOperatorPlacement(placedVia)) {
        return err(new BidError("Lot is not accepting bids", 400));
      }
    }

    if (this.legalEntityRepository) {
      const ent = await this.legalEntityRepository.findById(buyerLegalEntityId);
      if (!ent) {
        return err(new BidError("Buyer legal entity not found", 404));
      }
      if (!buyerEntityCanBid(ent.status)) {
        return err(
          new BidError(
            "Buyer legal entity is not authorised to bid",
            403,
            "entity_not_authorised_to_bid",
          ),
        );
      }
    }

    if (this.bidEligibility) {
      const elig = await this.bidEligibility.assertCanPlaceBid({
        placedByUserId,
        buyerLegalEntityId,
        lotId,
        amount,
        ...(maxAutoBidAmount !== undefined ? { maxAutoBidAmount } : {}),
        ...(autoBidStepAmount !== undefined ? { autoBidStepAmount } : {}),
        ...(bidPlacement?.placedVia != null ? { placedVia: bidPlacement.placedVia } : {}),
        ...(bidPlacement?.telephoneBookingId != null
          ? { telephoneBookingId: bidPlacement.telephoneBookingId }
          : {}),
        ...(bidPlacement?.saleId != null ? { saleId: bidPlacement.saleId } : {}),
        ...(bidPlacement?.paddleNumber != null ? { paddleNumber: bidPlacement.paddleNumber } : {}),
      });
      if (elig.isErr()) {
        return err(elig.error);
      }
    }

    return ok(undefined);
  }
}
