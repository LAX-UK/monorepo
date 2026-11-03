/** Plain names for the events integrations carry, so a row reads "Payment to Xero". */
const EVENT_LABELS: Readonly<Record<string, string>> = {
  "payment.captured": "Payment",
  "payment.refunded": "Refund",
  "lot.ended": "Lot sale",
  "payout.paid": "Payout",
  "payout.settlement_created": "Payout settlement",
};

/** "user.email_verified" becomes "User email verified". */
function humanise(eventType: string): string {
  const words = eventType.replace(/[._-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function eventLabel(eventType: string | null): string {
  if (!eventType) return "Delivery";
  return EVENT_LABELS[eventType] ?? humanise(eventType);
}
