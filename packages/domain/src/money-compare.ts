/** String money compare for domain / shared helpers (no floating point). */

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

export function moneyLt(a: string, b: string): boolean {
  return parseMoneyToMinorUnits(a) < parseMoneyToMinorUnits(b);
}

export function moneyGt(a: string, b: string): boolean {
  return parseMoneyToMinorUnits(a) > parseMoneyToMinorUnits(b);
}

/** Convert a finite JS number (major units) to minor units without float drift. */
export function numberToMinorUnits(amount: number): bigint {
  if (!Number.isFinite(amount)) return 0n;
  const rounded = Math.round(amount * 100);
  return BigInt(rounded);
}

export function minorUnitsToMoneyString(minor: bigint): string {
  const neg = minor < 0n;
  const abs = neg ? -minor : minor;
  const whole = abs / 100n;
  const frac = abs % 100n;
  const s = `${whole}.${frac.toString().padStart(2, "0")}`;
  return neg ? `-${s}` : s;
}

export function numberToMoneyString(amount: number): string {
  return minorUnitsToMoneyString(numberToMinorUnits(amount));
}

export function addMoneyStrings(a: string, b: string): string {
  return minorUnitsToMoneyString(parseMoneyToMinorUnits(a) + parseMoneyToMinorUnits(b));
}

export function minMoneyStrings(a: string, b: string): string {
  const aMinor = parseMoneyToMinorUnits(a);
  const bMinor = parseMoneyToMinorUnits(b);
  return minorUnitsToMoneyString(aMinor <= bMinor ? aMinor : bMinor);
}
