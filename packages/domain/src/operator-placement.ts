/** Telephone, absentee, and saleroom bids are entered by staff/automation, not self-service. */
export function isOperatorPlacement(placedVia?: string | null): boolean {
  return placedVia === "telephone" || placedVia === "absentee" || placedVia === "saleroom";
}
