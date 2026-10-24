/**
 * Pounds on screen, pence in data. Staff type and read pounds ("12.50"); APIs take whole pence.
 * Parsing is strict so a typo never becomes a different amount: at most two decimal places, an
 * optional "£" and thousands commas, nothing else.
 */
export type ParsedPence =
  | { ok: true; pence: number }
  | { ok: false; reason: "empty" | "invalid" | "too_precise" };

const AMOUNT = /^(\d{1,3}(,\d{3})+|\d+)?(\.(\d*))?$/;

export function parsePoundsToPence(input: string): ParsedPence {
  const text = input.trim().replace(/^£\s*/, "");
  if (text === "") return { ok: false, reason: "empty" };
  const match = AMOUNT.exec(text);
  if (!match || (match[1] === undefined && !match[4])) return { ok: false, reason: "invalid" };
  const whole = (match[1] ?? "0").replaceAll(",", "");
  const fraction = match[4] ?? "";
  if (fraction.length > 2) return { ok: false, reason: "too_precise" };
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(pence)) return { ok: false, reason: "invalid" };
  return { ok: true, pence };
}

const POUNDS = new Intl.NumberFormat("en-GB", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const GBP = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/** "1,234.50" — the editable text for an amount, without the symbol. */
export function formatPenceAsPounds(pence: number): string {
  return POUNDS.format(pence / 100);
}

/** "£1,234.50" — an amount for display. */
export function formatGbp(pence: number): string {
  return GBP.format(pence / 100);
}
