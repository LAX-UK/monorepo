const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const GBP_WHOLE = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** "£850.00": baskets, checkout, orders and invoices always show the pence. */
export function formatGbpPence(pence: number): string {
  return GBP.format(pence / 100);
}

/**
 * "£340" on browsing and display pages (cards, the home page, the edition page), where pence add
 * noise. Basket, checkout, orders and invoices keep the pence. A price that is not a whole number
 * of pounds keeps its pence ("£99.50"), so nothing is rounded away.
 */
export function formatGbpPenceForDisplay(pence: number): string {
  return pence % 100 === 0 ? GBP_WHOLE.format(pence / 100) : formatGbpPence(pence);
}
