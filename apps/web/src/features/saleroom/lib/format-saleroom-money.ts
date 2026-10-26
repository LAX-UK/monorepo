import { formatStaffMoney } from "@auction/staff-ui";

/**
 * A saleroom amount held as a decimal string or number in pounds ("1250.50"), written the way
 * every staff screen writes money. Anything that is not a number reads as a dash.
 */
export function formatSaleroomMoney(
  amount: string | number | null | undefined,
  currency = "GBP",
): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const value = typeof amount === "number" ? amount : Number.parseFloat(amount);
  if (!Number.isFinite(value)) return "—";
  return formatStaffMoney(Math.round(value * 100), currency);
}
