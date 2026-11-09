import {
  type PrivateSalePolicy,
  type PrivateSalePolicyInput,
  type VatTreatment,
  resolvePrivateSalePolicy,
} from "@auction/domain";
import type { Env } from "../../env.js";

export type PrivateSalePolicyEnv = Pick<
  Env,
  | "PRIVATE_SALE_COMMISSION_BPS"
  | "PRIVATE_SALE_BUYER_FEE_BPS"
  | "PRIVATE_SALE_VAT_TREATMENTS"
  | "PRIVATE_SALE_TERMS_VERSION"
  | "SOF_THRESHOLD_AMOUNT"
> & {
  /** The environment suggests 7 and 14 days; the policy still reads them as optional values. */
  PRIVATE_SALE_PAYMENT_DUE_DAYS: number | undefined;
  PRIVATE_SALE_COLLECTION_DUE_DAYS: number | undefined;
};

/**
 * Reads `code:Label` pairs separated by semicolons. A label may contain commas and colons after
 * the first one, so the accountant's wording is kept as written.
 */
export function parseVatTreatments(raw: string | undefined): VatTreatment[] {
  if (!raw) return [];
  return raw
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair !== "")
    .map((pair) => {
      const at = pair.indexOf(":");
      if (at < 1) throw new RangeError(`VAT treatment "${pair}" must be written as code:Label`);
      return { code: pair.slice(0, at).trim(), label: pair.slice(at + 1).trim() };
    });
}

/**
 * The business values a private sale depends on, from the environment. The source of funds
 * threshold is the one the existing rule already uses. A value that is not set stays unset, so
 * the invoice and the agreement stay blocked on the deal until it is.
 */
export function privateSalePolicyFromEnv(env: PrivateSalePolicyEnv): PrivateSalePolicy {
  const input: PrivateSalePolicyInput = {
    sourceOfFundsThresholdMinor: Math.round(env.SOF_THRESHOLD_AMOUNT * 100),
    vatTreatments: parseVatTreatments(env.PRIVATE_SALE_VAT_TREATMENTS),
  };
  if (env.PRIVATE_SALE_COMMISSION_BPS !== undefined) {
    input.commissionRateBps = env.PRIVATE_SALE_COMMISSION_BPS;
  }
  if (env.PRIVATE_SALE_BUYER_FEE_BPS !== undefined) {
    input.buyerFeeBps = env.PRIVATE_SALE_BUYER_FEE_BPS;
  }
  if (env.PRIVATE_SALE_PAYMENT_DUE_DAYS !== undefined) {
    input.paymentDueDays = env.PRIVATE_SALE_PAYMENT_DUE_DAYS;
  }
  if (env.PRIVATE_SALE_COLLECTION_DUE_DAYS !== undefined) {
    input.collectionDueDays = env.PRIVATE_SALE_COLLECTION_DUE_DAYS;
  }
  if (env.PRIVATE_SALE_TERMS_VERSION !== undefined) {
    input.termsVersion = env.PRIVATE_SALE_TERMS_VERSION;
  }
  return resolvePrivateSalePolicy(input);
}
