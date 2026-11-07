/**
 * The payout reference a person reads out or quotes to us, such as `PO-2026-3FA9C1`: the year the
 * payout's period ends, then the first six characters of its id. It is built from fields the
 * payout already has, so it never changes and needs no new column; the id stays the address.
 */
export function formatPayoutReference(payout: { id: string; periodEnd: Date }): string {
  const year = Number.isNaN(payout.periodEnd.getTime())
    ? "0000"
    : String(payout.periodEnd.getUTCFullYear()).padStart(4, "0");
  const code = payout.id
    .replace(/[^0-9a-z]/gi, "")
    .slice(0, 6)
    .toUpperCase();
  return `PO-${year}-${code}`;
}
