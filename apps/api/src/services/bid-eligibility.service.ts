import type { Database } from "@auction/db";
import {
  buyerAgentAuthorisation,
  legalEntityMember,
  lot,
  saleRegistration,
  user,
} from "@auction/db/schema";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import { memberRequiresSaleRegistration } from "../lib/sale-registration-policy.js";
import type { BidEligibilityCheckInput, IBidEligibility } from "./interfaces/bid-eligibility.js";

function parseMoneyCap(raw: string | null | undefined): number | null {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function minPositiveCap(a: number | null, b: number | null): number | null {
  if (a == null) return b;
  if (b == null) return a;
  return Math.min(a, b);
}

export class BidEligibilityService implements IBidEligibility {
  constructor(private readonly db: Database) {}

  async assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>> {
    const { placedByUserId, buyerLegalEntityId, lotId, amount } = input;

    const [u] = await this.db
      .select({ kycStatus: user.kycStatus })
      .from(user)
      .where(eq(user.id, placedByUserId))
      .limit(1);
    if (!u) {
      return err(new BidError("User not found", 404));
    }
    if (u.kycStatus !== "approved") {
      return err(
        new BidError("Complete identity verification before bidding", 403, "kyc_required"),
      );
    }

    const [lotRow] = await this.db
      .select({ saleId: lot.saleId })
      .from(lot)
      .where(eq(lot.id, lotId))
      .limit(1);
    if (!lotRow) {
      return err(new BidError("Lot not found", 404));
    }

    const saleId = lotRow.saleId;

    const [mem] = await this.db
      .select({ role: legalEntityMember.role })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, buyerLegalEntityId),
          eq(legalEntityMember.userId, placedByUserId),
          isNull(legalEntityMember.removedAt),
        ),
      )
      .limit(1);

    if (!mem) {
      return err(new BidError("Not a member of this legal entity", 403, "membership_required"));
    }

    if (saleId && memberRequiresSaleRegistration(mem.role)) {
      const [reg] = await this.db
        .select({
          status: saleRegistration.status,
          bidLimit: saleRegistration.bidLimit,
        })
        .from(saleRegistration)
        .where(
          and(
            eq(saleRegistration.saleId, saleId),
            eq(saleRegistration.userId, placedByUserId),
            eq(saleRegistration.buyerLegalEntityId, buyerLegalEntityId),
          ),
        )
        .limit(1);

      if (!reg || reg.status !== "approved") {
        return err(
          new BidError(
            "Register and be approved to bid on this sale",
            403,
            "sale_registration_required",
          ),
        );
      }

      const regCap = parseMoneyCap(reg.bidLimit);
      if (regCap != null && amount > regCap) {
        return err(
          new BidError("Bid exceeds your approved limit for this sale", 403, "bid_limit_exceeded"),
        );
      }
    }

    if (memberRequiresSaleRegistration(mem.role)) {
      const now = new Date();
      const rows = await this.db
        .select({
          saleId: buyerAgentAuthorisation.saleId,
          bidLimit: buyerAgentAuthorisation.bidLimit,
        })
        .from(buyerAgentAuthorisation)
        .where(
          and(
            eq(buyerAgentAuthorisation.legalEntityId, buyerLegalEntityId),
            eq(buyerAgentAuthorisation.userId, placedByUserId),
            eq(buyerAgentAuthorisation.status, "active"),
            lte(buyerAgentAuthorisation.validFrom, now),
            or(
              isNull(buyerAgentAuthorisation.validUntil),
              gt(buyerAgentAuthorisation.validUntil, now),
            ),
            saleId
              ? or(
                  isNull(buyerAgentAuthorisation.saleId),
                  eq(buyerAgentAuthorisation.saleId, saleId),
                )
              : isNull(buyerAgentAuthorisation.saleId),
          ),
        );

      if (rows.length === 0) {
        return err(
          new BidError(
            "Buyer agent authorisation is required for this legal entity",
            403,
            "buyer_agent_authorisation_required",
          ),
        );
      }

      const saleScoped = saleId ? rows.filter((r) => r.saleId === saleId) : [];
      const scoped = saleScoped.length > 0 ? saleScoped : rows;

      let cap: number | null = null;
      for (const r of scoped) {
        cap = minPositiveCap(cap, parseMoneyCap(r.bidLimit));
      }

      if (cap != null && amount > cap) {
        return err(
          new BidError("Bid exceeds buyer agent authorisation limit", 403, "bid_limit_exceeded"),
        );
      }
    }

    return ok(undefined);
  }
}
