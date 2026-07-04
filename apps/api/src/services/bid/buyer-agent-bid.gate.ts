import type { IBuyerAgentAuthorisationReader } from "@auction/persistence/interfaces";
import type { LegalEntityMemberRole } from "@auction/types";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../../lib/errors.js";
import { memberRequiresSaleRegistration } from "../../lib/sale-registration-policy.js";
import { minPositiveCap, parseMoneyCap } from "./bid-cap.util.js";

export class BuyerAgentBidGate {
  constructor(private readonly reader: IBuyerAgentAuthorisationReader) {}

  async assertCanBid(input: {
    saleId: string | null;
    placedByUserId: string;
    buyerLegalEntityId: string;
    memberRole: LegalEntityMemberRole;
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

    const saleScoped = input.saleId ? rows.filter((r) => r.saleId === input.saleId) : [];
    const scoped = saleScoped.length > 0 ? saleScoped : rows;

    let cap: number | null = null;
    for (const r of scoped) {
      cap = minPositiveCap(cap, parseMoneyCap(r.bidLimit));
    }

    if (cap != null && input.effectiveAmount > cap) {
      return err(
        new BidError("Bid exceeds buyer agent authorisation limit", 403, "bid_limit_exceeded"),
      );
    }

    return ok(undefined);
  }
}
