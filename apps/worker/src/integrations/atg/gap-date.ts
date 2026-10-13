const MS_DATE = /^\/Date\((-?\d+)(?:[+-]\d{4})?\)\/$/;

/**
 * Parses GAP dates. Responses use the WCF form `/Date(1700000000000-0000)/` (epoch ms is
 * already UTC; the offset suffix is informational), but some fields arrive as ISO 8601.
 */
export function parseGapDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  const ms = MS_DATE.exec(trimmed);
  const date = ms ? new Date(Number(ms[1])) : new Date(trimmed);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** GAP accepts ISO 8601 UTC on input. */
export function toGapDate(date: Date): string {
  return date.toISOString();
}
