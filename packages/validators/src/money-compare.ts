/** String money compare for validators / shared helpers (no floating point). */

export function parseMoneyToMinorUnits(raw: string): bigint {
  const s = raw.trim();
  if (!s) return 0n;
  const neg = s.startsWith("-");
  const u = neg ? s.slice(1) : s;
  const parts = u.split(".");
  const wholeRaw = parts[0] ?? "0";
  const fracRaw = parts[1] ?? "";
  const whole = BigInt((wholeRaw.replace(/\D/g, "") || "0").replace(/^0+(?=\d)/, "") || "0");
  const fracDigits = `${fracRaw.replace(/\D/g, "")}00`.slice(0, 2);
  const frac = BigInt(fracDigits || "0");
  const minor = whole * 100n + frac;
  return neg ? -minor : minor;
}

export function moneyEq(a: string, b: string): boolean {
  return parseMoneyToMinorUnits(a) === parseMoneyToMinorUnits(b);
}

export function moneyGte(a: string, b: string): boolean {
  return parseMoneyToMinorUnits(a) >= parseMoneyToMinorUnits(b);
}
