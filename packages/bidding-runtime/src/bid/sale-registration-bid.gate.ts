import { memberRequiresSaleRegistration } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import type { ISaleRegistrationBidReader } from "../ports.js";
import { parseMoneyCap } from "./bid-cap.util.js";

export class SaleRegistrationBidGate {
  constructor(private readonly reader: ISaleRegistrationBidReader) {}

  async assertCanBid(input: {
    saleId: string;
    placedByUserId: string;
    buyerLegalEntityId: string;
    memberRole: Parameters<typeof memberRequiresSaleRegistration>[0];
    effectiveAmount: number;
    operatorBypass: boolean;
  }): Promise<Result<void, BidError>> {
    if (input.operatorBypass) return ok(undefined);

    const registration = await this.reader.findRegistration(
      input.saleId,
      input.placedByUserId,
      input.buyerLegalEntityId,
    );
    if (memberRequiresSaleRegistration(input.memberRole) && registration?.status !== "approved") {
      return err(
        new BidError(
          "Register and be approved to bid on this sale",
          403,
          "sale_registration_required",
        ),
      );
    }
    const cap = registration?.status === "approved" ? parseMoneyCap(registration.bidLimit) : null;
    if (cap != null && input.effectiveAmount > cap) {
      return err(
        new BidError("Bid exceeds your approved limit for this sale", 403, "bid_limit_exceeded"),
      );
    }
    return ok(undefined);
  }
}
