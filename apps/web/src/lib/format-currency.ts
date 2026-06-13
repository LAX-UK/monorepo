const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

export function formatMoney(amount: string | number): string {
  if (amount === "undefined" || amount === "null") return "—";
  const n = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (Number.isNaN(n)) {
    if (typeof amount === "string" && amount.trim() !== "" && !/^-?\d/.test(amount.trim())) {
      return amount;
    }
    return "—";
  }
  return gbp.format(n);
}
