const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatMoney(amount: string | number): string {
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (Number.isNaN(n)) return amount.toString();
  return gbp.format(n);
}
