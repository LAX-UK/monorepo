/** Spreadsheet apps run cells that start with these as formulas; a leading quote stops that. */
const FORMULA_PREFIX = /^[=+\-@]/;

/** One CSV cell, quoted when it must be and never read as a formula. */
export function csvCell(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** A CSV document: the header, then one line per row, ending with a newline. */
export function csvDocument(
  header: readonly string[],
  rows: readonly (readonly string[])[],
): string {
  return `${[header, ...rows].map((cells) => cells.map(csvCell).join(",")).join("\n")}\n`;
}

const DAY_MS = 86_400_000;

/** A period of whole days as `YYYY-MM-DD`, the end day included; `null` when neither is given. */
export function periodOf(
  from: string | null,
  to: string | null,
): { from: number; to: number } | null {
  const start = from ? Date.parse(`${from}T00:00:00Z`) : Number.NaN;
  const end = to ? Date.parse(`${to}T00:00:00Z`) + DAY_MS : Number.NaN;
  if (Number.isNaN(start) && Number.isNaN(end)) return null;
  return {
    from: Number.isNaN(start) ? Number.NEGATIVE_INFINITY : start,
    to: Number.isNaN(end) ? Number.POSITIVE_INFINITY : end,
  };
}

export function inPeriod(at: number, period: { from: number; to: number } | null): boolean {
  return !period || (at >= period.from && at < period.to);
}
