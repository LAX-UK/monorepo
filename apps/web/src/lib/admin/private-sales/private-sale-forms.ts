import type { DealRecord, TermKey } from "@/lib/data/http/admin-private-sales.schema";

/** A rate as the form holds it ("0.025" for 2.5%) from basis points. */
export function bpsToRate(bps: number): string {
  const rate = (bps / 10_000).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
  return rate === "" ? "0" : rate;
}

/** Basis points from a rate ("0.025" is 250), or null when it is not a rate from 0% to 100%. */
export function rateToBps(rate: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(rate.trim())) return null;
  const bps = Math.round(Number(rate) * 10_000);
  return bps >= 0 && bps <= 10_000 ? bps : null;
}

export type TermsDraft = {
  priceMinor: number | null;
  costsMinor: number | null;
  /** Decimal rates, "" when empty, null while the text is not a number. */
  buyerFeeRate: string | null;
  sellerCommissionRate: string | null;
  vatTreatment: string | null;
  partiesDisclosed: boolean;
  offerExpiresAt: string | null;
};

export function initialTermsDraft(deal: DealRecord): TermsDraft {
  return {
    priceMinor: deal.priceMinor,
    costsMinor: deal.costsMinor,
    buyerFeeRate: bpsToRate(deal.buyerFeeBps),
    sellerCommissionRate:
      deal.sellerCommissionBps === null ? "" : bpsToRate(deal.sellerCommissionBps),
    vatTreatment: deal.vatTreatment,
    partiesDisclosed: deal.partiesDisclosed,
    offerExpiresAt: deal.offerExpiresAt,
  };
}

export type TermsErrors = Partial<Record<TermKey, string>>;

/** What is wrong with the terms the person may change, in a sentence each. */
export function validateTerms(draft: TermsDraft, editable: readonly TermKey[]): TermsErrors {
  const errors: TermsErrors = {};
  const open = new Set(editable);
  if (open.has("priceMinor") && draft.priceMinor !== null && draft.priceMinor <= 0) {
    errors.priceMinor = "Enter a price above £0.00, or leave it empty until one is agreed.";
  }
  if (open.has("costsMinor") && draft.costsMinor === null) {
    errors.costsMinor = "Enter the agreed costs, or £0.00 for none.";
  }
  if (open.has("buyerFeeBps") && (draft.buyerFeeRate === null || draft.buyerFeeRate === "")) {
    errors.buyerFeeBps = "Enter the buyer's fee as a percentage, or 0 for none.";
  } else if (
    open.has("buyerFeeBps") &&
    draft.buyerFeeRate !== null &&
    rateToBps(draft.buyerFeeRate) === null
  ) {
    errors.buyerFeeBps = "The buyer's fee must be between 0% and 100%.";
  }
  if (
    open.has("sellerCommissionBps") &&
    draft.sellerCommissionRate !== null &&
    draft.sellerCommissionRate !== "" &&
    rateToBps(draft.sellerCommissionRate) === null
  ) {
    errors.sellerCommissionBps = "The commission must be between 0% and 100%.";
  } else if (open.has("sellerCommissionBps") && draft.sellerCommissionRate === null) {
    errors.sellerCommissionBps = "Enter the commission as a percentage.";
  }
  return errors;
}

/**
 * Only what changed, only from the terms the person may change, as the API takes it. An empty
 * price or commission is sent as null, which clears it.
 */
export function changedTerms(
  deal: DealRecord,
  draft: TermsDraft,
  editable: readonly TermKey[],
): Record<string, unknown> {
  const open = new Set(editable);
  const before = initialTermsDraft(deal);
  const changes: Record<string, unknown> = {};
  if (open.has("priceMinor") && draft.priceMinor !== before.priceMinor) {
    changes.priceMinor = draft.priceMinor;
  }
  if (open.has("costsMinor") && draft.costsMinor !== before.costsMinor) {
    changes.costsMinor = draft.costsMinor ?? 0;
  }
  if (open.has("buyerFeeBps") && draft.buyerFeeRate !== before.buyerFeeRate) {
    const bps = rateToBps(draft.buyerFeeRate ?? "");
    if (bps !== null) changes.buyerFeeBps = bps;
  }
  if (
    open.has("sellerCommissionBps") &&
    draft.sellerCommissionRate !== before.sellerCommissionRate
  ) {
    changes.sellerCommissionBps =
      draft.sellerCommissionRate === "" ? null : rateToBps(draft.sellerCommissionRate ?? "");
  }
  if (open.has("vatTreatment") && draft.vatTreatment !== before.vatTreatment) {
    changes.vatTreatment = draft.vatTreatment;
  }
  if (open.has("partiesDisclosed") && draft.partiesDisclosed !== before.partiesDisclosed) {
    changes.partiesDisclosed = draft.partiesDisclosed;
  }
  if (open.has("offerExpiresAt") && draft.offerExpiresAt !== before.offerExpiresAt) {
    changes.offerExpiresAt = draft.offerExpiresAt;
  }
  return changes;
}
