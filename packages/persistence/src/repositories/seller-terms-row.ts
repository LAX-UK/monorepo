import type { saleSellerTerms } from "@auction/db/schema";
import {
  SELLER_RULE_VERSION,
  type SellerTermsHeldReason,
  type SellerTermsSnapshot,
} from "@auction/domain";

type NewSellerTermsRow = typeof saleSellerTerms.$inferInsert;

/** How a stored row was made: when the invoice was raised, or priced again at payout. */
export type SellerTermsSource = "raised" | "recomputed_at_payout" | "agreement_recorded";

/**
 * The stored shape of a snapshot, one row per basis. Figures a basis does not carry are left
 * unset, which is what the table's shape check requires. `legacyPlatformFeePence` is the payment's
 * old-rule `platform_fee`, kept beside the new figures so old and new can be reconciled per sale.
 */
export function sellerTermsRow(
  paymentId: string,
  terms: SellerTermsSnapshot,
  legacyPlatformFeePence: number | null = null,
  source: SellerTermsSource = "raised",
): NewSellerTermsRow {
  const common = {
    paymentId,
    legacyPlatformFeePence,
    lotId: terms.lotId,
    sellerLegalEntityId: terms.sellerLegalEntityId,
    basis: terms.basis,
    hammerPence: terms.hammerPence,
    premiumPence: terms.premiumPence,
    ruleVersion: terms.ruleVersion,
    source,
  } satisfies NewSellerTermsRow;
  switch (terms.basis) {
    case "agreement":
      return {
        ...common,
        agreementId: terms.agreementId,
        commissionBps: terms.commissionBps,
        commissionPence: terms.commissionPence,
        commissionVatTreatment: terms.commissionVatTreatment,
        commissionVatBps: terms.commissionVatBps,
        commissionVatPence: terms.commissionVatPence,
        otherCharges: [...terms.otherCharges],
        sellerNetPence: terms.sellerNetPence,
      };
    case "lax_owned":
      return common;
    case "held":
      return { ...common, heldReason: terms.heldReason };
  }
}

type SellerTermsRow = typeof saleSellerTerms.$inferSelect;

const HELD_REASONS: ReadonlySet<SellerTermsHeldReason> = new Set<SellerTermsHeldReason>([
  "no_agreement",
  "not_accepted",
  "no_commission",
  "other_seller",
  "vat_setting_missing",
  "negative_net",
  "legacy_invoice",
]);

function storedNumber(value: number | null, column: string): number {
  if (value === null) throw new Error(`sale_seller_terms.${column} is missing on a priced row`);
  return value;
}

/**
 * A stored row read back as the snapshot it was written from. The table's shape check guarantees
 * each basis carries its own figures; a row that does not is refused rather than paid on a guess.
 */
export function sellerTermsSnapshotFromRow(row: SellerTermsRow): SellerTermsSnapshot {
  const base = {
    lotId: row.lotId,
    sellerLegalEntityId: row.sellerLegalEntityId,
    hammerPence: row.hammerPence,
    premiumPence: row.premiumPence,
    ruleVersion: SELLER_RULE_VERSION,
  } as const;
  if (row.ruleVersion !== SELLER_RULE_VERSION) {
    throw new Error(`sale_seller_terms row ${row.id} has an unknown rule ${row.ruleVersion}`);
  }
  switch (row.basis) {
    case "lax_owned":
      return { ...base, basis: "lax_owned" };
    case "held": {
      const reason = row.heldReason as SellerTermsHeldReason | null;
      if (!reason || !HELD_REASONS.has(reason)) {
        throw new Error(`sale_seller_terms row ${row.id} is held with no known reason`);
      }
      return { ...base, basis: "held", heldReason: reason };
    }
    case "agreement": {
      const treatment = row.commissionVatTreatment;
      if (treatment !== "standard" && treatment !== "not_registered") {
        throw new Error(`sale_seller_terms row ${row.id} has no VAT treatment`);
      }
      if (!row.agreementId) throw new Error(`sale_seller_terms row ${row.id} has no agreement`);
      return {
        ...base,
        basis: "agreement",
        agreementId: row.agreementId,
        commissionBps: storedNumber(row.commissionBps, "commission_bps"),
        commissionPence: storedNumber(row.commissionPence, "commission_pence"),
        commissionVatTreatment: treatment,
        commissionVatBps: storedNumber(row.commissionVatBps, "commission_vat_bps"),
        commissionVatPence: storedNumber(row.commissionVatPence, "commission_vat_pence"),
        otherCharges: [],
        sellerNetPence: storedNumber(row.sellerNetPence, "seller_net_pence"),
      };
    }
    default:
      throw new Error(`sale_seller_terms row ${row.id} has an unknown basis ${row.basis}`);
  }
}
