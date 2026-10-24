/** Platform settlement currency; matches the API's payment currency. */
export const EMAIL_DEFAULT_CURRENCY = "GBP";

const ISO_CURRENCY = /^[A-Z]{3}$/;

/**
 * Formats a major-unit decimal string ("1250.00") for display in an email, e.g. "£1,250.00".
 * Returns null when the amount is missing or not a number, so a caller can leave the sentence
 * out instead of printing a raw value or a placeholder.
 */
export function formatMoneyMajor(
  amount: string | null | undefined,
  currency: string | null | undefined = EMAIL_DEFAULT_CURRENCY,
): string | null {
  if (amount === null || amount === undefined || amount.trim() === "") return null;
  const value = Number.parseFloat(amount);
  if (!Number.isFinite(value)) return null;
  const code = currency?.trim().toUpperCase();
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: code && ISO_CURRENCY.test(code) ? code : EMAIL_DEFAULT_CURRENCY,
  }).format(value);
}
