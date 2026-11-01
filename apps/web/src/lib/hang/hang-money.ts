import { formatMoney } from "@/lib/format-currency";

/** Whole units when there are no pennies ("£7,750"), pennies only when they matter. */
export function formatHangMoney(amount: string, currency: string): string {
  const n = Number.parseFloat(amount);
  if (!Number.isFinite(n)) return "—";
  const whole = Number.isInteger(n);
  return whole
    ? new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n)
    : formatMoney(amount, currency);
}
