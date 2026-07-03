import type { LegalEntityMemberRole } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import { memberRequiresSaleRegistration } from "../../lib/sale-registration-policy.js";
import type { ISaleRegistrationBidReader } from "../../repositories/interfaces/sale-registration-bid.reader.js";
import { parseMoneyCap } from "./bid-cap.util.js";

export class SaleRegistrationBidGate {
  constructor(private readonly reader: ISaleRegistrationBidReader) {}

  async assertCanBid(input: {
    saleId: string;
    placedByUserId: string;
    buyerLegalEntityId: string;
    memberRole: LegalEntityMemberRole;
    effectiveAmount: number;
    operatorBypass: boolean;
  }): Promise<Result<void, BidError>> {
    if (input.operatorBypass) {
      return ok(undefined);
    }

    const reg = await this.reader.findRegistration(
      input.saleId,
      input.placedByUserId,
      input.buyerLegalEntityId,
    );

    if (memberRequiresSaleRegistration(input.memberRole)) {
      if (!reg || reg.status !== "approved") {
        return err(
          new BidError(
            "Register and be approved to bid on this sale",
            403,
            "sale_registration_required",
          ),
        );
      }
    }

    if (reg?.status === "approved") {
      const regCap = parseMoneyCap(reg.bidLimit);
      if (regCap != null && input.effectiveAmount > regCap) {
        return err(
          new BidError("Bid exceeds your approved limit for this sale", 403, "bid_limit_exceeded"),
        );
      }
    }

    return ok(undefined);
  }
}
