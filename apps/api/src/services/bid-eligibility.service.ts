import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import {
  buyerAgentAuthorisation,
  legalEntityMember,
  lot,
  saleRegistration,
  telephoneBidBooking,
} from "@auction/db/schema";
import { type AutoBidLotRules, validateAutoBidStepAmount } from "@auction/validators";
import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { type Result, err, ok } from "neverthrow";
import { BidError } from "../lib/errors.js";
import { memberRequiresSaleRegistration } from "../lib/sale-registration-policy.js";
import type { IAmlHoldStore } from "./aml/ports.js";
import type { BidEligibilityCheckInput, IBidEligibility } from "./interfaces/bid-eligibility.js";
import type { IKycService } from "./interfaces/kyc-service.js";
import { KycRequiredError } from "./interfaces/kyc-service.js";

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
  constructor(
    private readonly db: Database,
    private readonly kycService: IKycService | null = null,
    private readonly amlHoldStore: IAmlHoldStore | null = null,
  ) {}

  async assertCanPlaceBid(input: BidEligibilityCheckInput): Promise<Result<void, BidError>> {
    const {
      placedByUserId,
      buyerLegalEntityId,
      lotId,
      amount,
      maxAutoBidAmount,
      autoBidStepAmount,
      placedVia,
      telephoneBookingId,
    } = input;
    const effectiveAmount =
      maxAutoBidAmount != null && Number.isFinite(maxAutoBidAmount)
        ? Math.max(amount, maxAutoBidAmount)
        : amount;

    if (this.kycService?.isConfigured()) {
      try {
        await this.kycService.enforceThreshold(placedByUserId);
      } catch (caught) {
        if (caught instanceof KycRequiredError) {
          return err(
            new BidError("Complete identity verification before bidding", 402, "kyc_required"),
          );
        }
        throw caught;
      }
    }

    if (this.amlHoldStore) {
      const hold = await this.amlHoldStore.getHold(placedByUserId);
      if (hold?.status === "blocked") {
        return err(
          new BidError("Bidding is suspended pending compliance review", 403, "aml_blocked"),
        );
      }
    }

    const [lotRow] = await this.db
      .select({
        saleId: lot.saleId,
        autoBidEnabled: lot.autoBidEnabled,
        minBidIncrement: lot.minBidIncrement,
        autoBidStepMin: lot.autoBidStepMin,
        autoBidStepMax: lot.autoBidStepMax,
        autoBidStepPresets: lot.autoBidStepPresets,
      })
      .from(lot)
      .where(and(eq(lot.id, lotId), lotNotDeleted()))
      .limit(1);
    if (!lotRow) {
      return err(new BidError("Lot not found", 404));
    }

    const autoRules: AutoBidLotRules = {
      autoBidEnabled: lotRow.autoBidEnabled ?? true,
      minBidIncrement: String(lotRow.minBidIncrement),
      autoBidStepMin: lotRow.autoBidStepMin != null ? String(lotRow.autoBidStepMin) : null,
      autoBidStepMax: lotRow.autoBidStepMax != null ? String(lotRow.autoBidStepMax) : null,
      autoBidStepPresets: lotRow.autoBidStepPresets ?? null,
    };

    if (maxAutoBidAmount != null || autoBidStepAmount != null) {
      if (autoRules.autoBidEnabled === false) {
        return err(new BidError("Auto-bid is not enabled for this lot", 403, "auto_bid_disabled"));
      }
      if (autoBidStepAmount != null) {
        const stepErr = validateAutoBidStepAmount(autoRules, autoBidStepAmount);
        if (stepErr) {
          return err(new BidError(stepErr, 400, "auto_bid_step_invalid"));
        }
      }
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

    const telephoneOperatorBypass =
      placedVia === "telephone" &&
      telephoneBookingId != null &&
      saleId != null &&
      (await this.isActiveTelephoneBooking(telephoneBookingId, saleId));

    if (telephoneOperatorBypass && telephoneBookingId != null) {
      const cap = await this.telephoneAuthorizedMax(telephoneBookingId);
      if (cap != null && effectiveAmount > cap + 1e-9) {
        return err(
          new BidError("Bid exceeds authorized telephone limit", 403, "authorized_max_exceeded"),
        );
      }
    }

    if (saleId && memberRequiresSaleRegistration(mem.role) && !telephoneOperatorBypass) {
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
      if (regCap != null && effectiveAmount > regCap) {
        return err(
          new BidError("Bid exceeds your approved limit for this sale", 403, "bid_limit_exceeded"),
        );
      }
    }

    if (memberRequiresSaleRegistration(mem.role) && !telephoneOperatorBypass) {
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

      if (cap != null && effectiveAmount > cap) {
        return err(
          new BidError("Bid exceeds buyer agent authorisation limit", 403, "bid_limit_exceeded"),
        );
      }
    }

    return ok(undefined);
  }

  private async isActiveTelephoneBooking(bookingId: string, saleId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ status: telephoneBidBooking.status, saleId: telephoneBidBooking.saleId })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, bookingId))
      .limit(1);
    if (!row || row.saleId !== saleId) return false;
    return row.status === "confirmed" || row.status === "in_progress";
  }

  private async telephoneAuthorizedMax(bookingId: string): Promise<number | null> {
    const [row] = await this.db
      .select({ reserveAltMax: telephoneBidBooking.reserveAltMax })
      .from(telephoneBidBooking)
      .where(eq(telephoneBidBooking.id, bookingId))
      .limit(1);
    return parseMoneyCap(row?.reserveAltMax != null ? String(row.reserveAltMax) : null);
  }
}
