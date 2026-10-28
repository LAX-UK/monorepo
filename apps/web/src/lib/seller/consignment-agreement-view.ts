import { formatDate, formatMoney } from "@/lib/ui/format";
import type { ConsignmentAgreement } from "@auction/types";

/** Names of the seller-conditions versions, for people. */
const TERMS_VERSION_NAMES: Record<string, string> = {
  "conditions-of-business-part-c-v1": "Version 1",
};

export function termsVersionName(version: string): string {
  return TERMS_VERSION_NAMES[version] ?? version;
}

export type AgreementTermRow = { label: string; value: string };

export type ConsignmentAgreementViewModel = {
  terms: AgreementTermRow[];
  versionName: string;
  accepted: { by: string; on: string } | null;
};

function money(value: string, currency: string): string {
  // Whole pounds read better in an estimate; pence are kept when there are any.
  const amount = Number.parseFloat(value);
  if (Number.isFinite(amount) && Number.isInteger(amount)) {
    return formatMoney(amount, currency).replace(/\.00$/, "");
  }
  return formatMoney(value, currency);
}

function percent(value: string): string {
  return `${String(Number.parseFloat(value))}%`;
}

/** The specialist's proposal and the acceptance, as the seller reads them. */
export function consignmentAgreementViewModel(
  agreement: ConsignmentAgreement,
): ConsignmentAgreementViewModel {
  const terms: AgreementTermRow[] = [];
  if (agreement.estimateLow && agreement.estimateHigh) {
    terms.push({
      label: "Estimate",
      value: `${money(agreement.estimateLow, agreement.currency)} – ${money(agreement.estimateHigh, agreement.currency)}`,
    });
  }
  if (agreement.reservePrice) {
    terms.push({ label: "Reserve", value: money(agreement.reservePrice, agreement.currency) });
  }
  if (agreement.commissionPercent) {
    terms.push({ label: "Seller's commission", value: percent(agreement.commissionPercent) });
  }
  terms.push({ label: "Proposed", value: formatDate(agreement.proposedAt) });
  return {
    terms,
    versionName: termsVersionName(agreement.termsVersion),
    accepted: agreement.acceptedAt
      ? { by: agreement.acceptedByName ?? "your account", on: formatDate(agreement.acceptedAt) }
      : null,
  };
}
