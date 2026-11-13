import type { Database } from "@auction/db";
import { lotNotDeleted } from "@auction/db";
import { legalEntity, lot, payment, payoutLine, saleSellerTerms } from "@auction/db/schema";
import type { SellerTermsHeldReason } from "@auction/domain";
import { and, desc, eq, notExists, sql } from "drizzle-orm";
import type { AdminWorkItemSourceRow } from "../interfaces/admin-work-items.reader.js";
import { adminWorkItemHref } from "../lib/admin-work-item-href.js";

/** What each held reason asks staff to fix. One entry per reason, so the wording lives here. */
const HELD_FIX: Record<SellerTermsHeldReason, string> = {
  no_agreement: "No signed agreement on record. Record the signed agreement to release it",
  not_accepted: "The seller has not accepted the agreement yet",
  no_commission: "The agreement has no commission. Record the signed agreement to release it",
  other_seller: "The agreement on record is for another seller",
  vat_setting_missing: "VAT setting for London Auction Xchange LTD is missing",
  negative_net: "The commission and VAT on it are more than the hammer",
  legacy_invoice:
    "The buyer's invoice has no hammer line, so the seller's figure cannot be worked out",
};

/** The task's headline per reason: "Payout held: no signed agreement". */
const HELD_TITLE: Record<SellerTermsHeldReason, string> = {
  no_agreement: "no signed agreement",
  not_accepted: "the seller hasn't accepted the agreement yet",
  no_commission: "the agreement has no commission",
  other_seller: "the agreement is for another seller",
  vat_setting_missing: "VAT setting for London Auction Xchange LTD is missing",
  negative_net: "deductions are more than the hammer",
  legacy_invoice: "the buyer's invoice has no hammer line",
};

/**
 * "Payout held: no signed agreement — Lot 21 · The Lock Keeper's House · Northbank Gallery Ltd":
 * the reason first, then the lot and who sold it, so the task reads without opening it.
 */
export function heldPayoutTaskTitle(input: {
  reason: SellerTermsHeldReason;
  lotNumber: number | null;
  lotTitle: string;
  sellerName: string | null;
}): string {
  const parts = [
    input.lotNumber !== null ? `Lot ${input.lotNumber}` : null,
    input.lotTitle,
    input.sellerName,
  ].filter((part): part is string => Boolean(part));
  return `Payout held: ${HELD_TITLE[input.reason]} — ${parts.join(" · ")}`;
}

const RECORDING_FIXES: ReadonlySet<SellerTermsHeldReason> = new Set([
  "no_agreement",
  "not_accepted",
  "no_commission",
  "other_seller",
]);

const isHeldReason = (value: string | null): value is SellerTermsHeldReason =>
  value !== null && value in HELD_FIX;

/**
 * Paid sales whose seller payout is held, for the lot's sales team: the buyer has paid in full, the
 * sale is on no payout, and its seller terms are held with a reason. The item clears itself when
 * the sale is priced (the next payout run prices it once the fix is in place, such as a recorded
 * agreement) or when the buyer is refunded.
 */
export class DrizzleHeldSellerTermsWorkItemsReader {
  constructor(private readonly db: Database) {}

  async list(limit: number): Promise<AdminWorkItemSourceRow[]> {
    const rows = await this.db
      .select({
        termsId: saleSellerTerms.id,
        heldReason: saleSellerTerms.heldReason,
        computedAt: saleSellerTerms.computedAt,
        lotId: lot.id,
        lotTitle: lot.title,
        lotNumber: lot.lotNumber,
        saleId: lot.saleId,
        sellerName: legalEntity.displayName,
      })
      .from(saleSellerTerms)
      .innerJoin(payment, eq(payment.id, saleSellerTerms.paymentId))
      .innerJoin(lot, eq(lot.id, saleSellerTerms.lotId))
      .leftJoin(legalEntity, eq(legalEntity.id, saleSellerTerms.sellerLegalEntityId))
      .where(
        and(
          eq(saleSellerTerms.basis, "held"),
          eq(payment.status, "captured"),
          sql`(${payment.amount})::numeric > 0`,
          lotNotDeleted(),
          notExists(
            this.db
              .select({ one: sql`1` })
              .from(payoutLine)
              .where(and(eq(payoutLine.paymentId, payment.id), eq(payoutLine.kind, "sale"))),
          ),
        ),
      )
      .orderBy(desc(saleSellerTerms.computedAt))
      .limit(limit);

    return rows.flatMap((row) => {
      if (!isHeldReason(row.heldReason)) return [];
      return [
        {
          sourceId: row.termsId,
          kind: "seller_payout_held" as const,
          domain: "saleroom" as const,
          title: heldPayoutTaskTitle({
            reason: row.heldReason,
            lotNumber: row.lotNumber,
            lotTitle: row.lotTitle,
            sellerName: row.sellerName ?? null,
          }),
          subtitle: HELD_FIX[row.heldReason],
          // Reasons a signed agreement fixes open the lot with its record dialog.
          href: `${adminWorkItemHref("seller_payout_held", { subjectId: row.lotId })}${
            RECORDING_FIXES.has(row.heldReason) ? "?record=agreement" : ""
          }`,
          saleId: row.saleId,
          createdAt: row.computedAt,
          sourceUpdatedAt: row.computedAt,
          assignedToUserId: null,
        },
      ];
    });
  }
}
