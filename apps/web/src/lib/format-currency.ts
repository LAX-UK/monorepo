const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(amount: string | number): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (Number.isNaN(n)) return amount.toString();
  return usd.format(n);
}
