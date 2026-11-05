/**
 * The business values a private sale depends on. Only the approved defaults are written here;
 * every other value is configuration, and while it is missing the transition that needs it is
 * blocked rather than guessed.
 */

/** A VAT treatment finance may choose for a deal, from the accountant's list. */
export type VatTreatment = { code: string; label: string };

/** Source of funds is asked for from £9,000 (the existing rule), in pence. */
export const DEFAULT_SOURCE_OF_FUNDS_THRESHOLD_MINOR = 900_000;
/** The UK art market participant AML threshold, £10,000 since 30 June 2026, in pence. */
export const DEFAULT_AML_THRESHOLD_MINOR = 1_000_000;
/** No buyer's fee unless one is set on the deal. */
export const DEFAULT_BUYER_FEE_BPS = 0;

export type PrivateSalePolicy = {
  /** The seller's commission for new deals; `null` until set. The invoice waits for a commission on the deal. */
  commissionRateBps: number | null;
  buyerFeeBps: number;
  /** Empty until the accountant's list is configured; the invoice waits for a treatment from it. */
  vatTreatments: readonly VatTreatment[];
  sourceOfFundsThresholdMinor: number;
  amlThresholdMinor: number;
  /** The private sale terms version both sides accept; `null` until the terms are approved. */
  termsVersion: string | null;
  /** Days from the invoice to payment due; `null` until set. */
  paymentDueDays: number | null;
  /** Days from payment to collection due; `null` leaves the collection date unset. */
  collectionDueDays: number | null;
};

/** What configuration supplies. Anything left out falls back to the approved default or stays unset. */
export type PrivateSalePolicyInput = Partial<{
  commissionRateBps: number | null;
  buyerFeeBps: number;
  vatTreatments: readonly VatTreatment[];
  sourceOfFundsThresholdMinor: number;
  amlThresholdMinor: number;
  termsVersion: string | null;
  paymentDueDays: number | null;
  collectionDueDays: number | null;
}>;

const VAT_CODE = /^[a-z0-9_]+$/;

function checkBps(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 0 || value > 10_000) {
    throw new RangeError(`${name} must be a whole number of basis points from 0 to 10000`);
  }
  return value;
}

function checkDays(name: string, value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 365) {
    throw new RangeError(`${name} must be a whole number of days from 1 to 365`);
  }
  return value;
}

function checkMinor(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative whole number of pence`);
  }
  return value;
}

/** Validates configuration and applies the approved defaults. Throws on a value that cannot be right. */
export function resolvePrivateSalePolicy(input: PrivateSalePolicyInput = {}): PrivateSalePolicy {
  const vatTreatments = (input.vatTreatments ?? []).map((t) => {
    if (!VAT_CODE.test(t.code) || t.label.trim() === "") {
      throw new RangeError("a VAT treatment needs a lowercase code and a label");
    }
    return { code: t.code, label: t.label.trim() };
  });
  if (new Set(vatTreatments.map((t) => t.code)).size !== vatTreatments.length) {
    throw new RangeError("VAT treatment codes must be unique");
  }
  return {
    commissionRateBps:
      input.commissionRateBps == null
        ? null
        : checkBps("commissionRateBps", input.commissionRateBps),
    buyerFeeBps: checkBps("buyerFeeBps", input.buyerFeeBps ?? DEFAULT_BUYER_FEE_BPS),
    vatTreatments,
    sourceOfFundsThresholdMinor: checkMinor(
      "sourceOfFundsThresholdMinor",
      input.sourceOfFundsThresholdMinor ?? DEFAULT_SOURCE_OF_FUNDS_THRESHOLD_MINOR,
    ),
    amlThresholdMinor: checkMinor(
      "amlThresholdMinor",
      input.amlThresholdMinor ?? DEFAULT_AML_THRESHOLD_MINOR,
    ),
    termsVersion: input.termsVersion?.trim() || null,
    paymentDueDays:
      input.paymentDueDays == null ? null : checkDays("paymentDueDays", input.paymentDueDays),
    collectionDueDays:
      input.collectionDueDays == null
        ? null
        : checkDays("collectionDueDays", input.collectionDueDays),
  };
}

export type PrivateSalePolicyGap =
  | "terms_version"
  | "commission_rate"
  | "vat_treatments"
  | "payment_due_days";

/** What must still be configured before a real deal can be agreed and invoiced. */
export function privateSalePolicyGaps(policy: PrivateSalePolicy): PrivateSalePolicyGap[] {
  const gaps: PrivateSalePolicyGap[] = [];
  if (policy.termsVersion === null) gaps.push("terms_version");
  if (policy.commissionRateBps === null) gaps.push("commission_rate");
  if (policy.vatTreatments.length === 0) gaps.push("vat_treatments");
  if (policy.paymentDueDays === null) gaps.push("payment_due_days");
  return gaps;
}

/** The terms a new deal starts with, taken from configuration. */
export function initialDealTerms(policy: PrivateSalePolicy): {
  buyerFeeBps: number;
  sellerCommissionBps: number | null;
} {
  return { buyerFeeBps: policy.buyerFeeBps, sellerCommissionBps: policy.commissionRateBps };
}
