import type { ISaleRegistrationBidReader } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { memberRequiresSaleRegistration } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import { numberToMoneyString } from "../bid-money.js";
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
      if (reg?.status === "pending") {
        return err(
          new BidError(
            "Your registration for this sale is awaiting approval",
            403,
            "sale_registration_pending",
          ),
        );
      }
      if (!reg || reg.status !== "approved") {
        return err(
          new BidError(
            "Register and be approved to bid on this sale",
            403,
            "sale_registration_required",
            reg ? { registration: reg.status } : undefined,
          ),
        );
      }
    }

    if (reg?.status === "approved") {
      const regCap = parseMoneyCap(reg.bidLimit);
      if (regCap != null && input.effectiveAmount > regCap) {
        return err(
          new BidError("Bid exceeds your approved limit for this sale", 403, "bid_limit_exceeded", {
            limitKind: "registration",
            limit: numberToMoneyString(regCap),
            available: numberToMoneyString(regCap),
          }),
        );
      }
    }

    return ok(undefined);
  }
}
