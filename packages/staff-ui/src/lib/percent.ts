/**
 * Percent on screen, a decimal rate in data. Staff type and read "25" or "12.5%"; APIs take the
 * rate as a decimal string ("0.25", "0.125"). The conversion shifts the decimal point in the
 * text itself, so no floating-point rounding can change the number someone typed.
 */
export type ParsedRate = { ok: true; rate: string } | { ok: false; reason: "empty" | "invalid" };

const PERCENT = /^(\d+)?(?:\.(\d*))?$/;

function trimZeros(whole: string, fraction: string): string {
  const w = whole.replace(/^0+(?=\d)/, "") || "0";
  const f = fraction.replace(/0+$/, "");
  return f ? `${w}.${f}` : w;
}

/**
 * "25" → "0.25", "12.5%" → "0.125", "100" → "1". Any well-formed number converts, even one out of
 * range or too precise, so the form's own rule can say what is wrong with it.
 */
export function parsePercentToRate(input: string): ParsedRate {
  const text = input.trim().replace(/\s*%$/, "");
  if (text === "") return { ok: false, reason: "empty" };
  const match = PERCENT.exec(text);
  if (!match || (match[1] === undefined && !match[2])) return { ok: false, reason: "invalid" };
  const digits = (match[1] ?? "0").padStart(3, "0");
  const fraction = match[2] ?? "";
  const whole = digits.slice(0, -2);
  return { ok: true, rate: trimZeros(whole, digits.slice(-2) + fraction) };
}

/** "0.25" → "25", "0.125" → "12.5"; the editable text for a rate, without the sign. */
export function formatRateAsPercent(rate: string): string {
  const text = rate.trim();
  const match = /^(\d+)(?:\.(\d*))?$/.exec(text);
  if (!match) return text;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return trimZeros((match[1] ?? "0") + fraction.slice(0, 2), fraction.slice(2));
}

/** "0.25" → "25%"; a rate for display. Text that is not a rate is shown as it is. */
export function formatStaffPercent(rate: string | number): string {
  const text = String(rate).trim();
  if (!/^\d+(\.\d*)?$/.test(text)) return text;
  return `${formatRateAsPercent(text)}%`;
}
