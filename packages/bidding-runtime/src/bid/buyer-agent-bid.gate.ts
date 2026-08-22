import { memberRequiresSaleRegistration } from "@auction/validators";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../bid-error.js";
import type { IBuyerAgentAuthorisationReader } from "../ports.js";
import { minPositiveCap, parseMoneyCap } from "./bid-cap.util.js";

export class BuyerAgentBidGate {
  constructor(private readonly reader: IBuyerAgentAuthorisationReader) {}

  async assertCanBid(input: {
    saleId: string | null;
    placedByUserId: string;
    buyerLegalEntityId: string;
    memberRole: Parameters<typeof memberRequiresSaleRegistration>[0];
    effectiveAmount: number;
    operatorBypass: boolean;
  }): Promise<Result<void, BidError>> {
    if (!memberRequiresSaleRegistration(input.memberRole) || input.operatorBypass) {
      return ok(undefined);
    }

    const rows = await this.reader.findActiveAuthorisations({
      legalEntityId: input.buyerLegalEntityId,
      userId: input.placedByUserId,
      saleId: input.saleId,
      now: new Date(),
    });
    if (rows.length === 0) {
      return err(
        new BidError(
          "Buyer agent authorisation is required for this legal entity",
          403,
          "buyer_agent_authorisation_required",
        ),
      );
    }
    const saleScoped = input.saleId ? rows.filter((row) => row.saleId === input.saleId) : [];
    let cap: number | null = null;
    for (const row of saleScoped.length > 0 ? saleScoped : rows) {
      cap = minPositiveCap(cap, parseMoneyCap(row.bidLimit));
    }
    if (cap != null && input.effectiveAmount > cap) {
      return err(
        new BidError("Bid exceeds buyer agent authorisation limit", 403, "bid_limit_exceeded"),
      );
    }
    return ok(undefined);
  }
}
