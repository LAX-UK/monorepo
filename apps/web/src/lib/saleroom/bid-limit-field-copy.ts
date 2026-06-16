/** Shared copy for sale-registration bid limit fields (hammer cap, not deposit). */

export const BID_LIMIT_FIELD_LABEL = "Maximum hammer (optional)";

export function bidLimitFieldHelp(currency = "GBP"): string {
  return `Caps hammer bids on this sale for this entity (${currency}). Leave blank for no cap. Not a deposit or buyer's premium.`;
}

export function bidLimitFieldPlaceholder(currency = "GBP"): string {
  return `e.g. 50000 ${currency}`;
}
