import { parsePoundsToPence } from "@auction/staff-ui";

/** Pounds as the API stores them ("1250.5", "-20.00") in whole pence, exactly; null if unreadable. */
export function poundsToPenceOrNull(pounds: string): number | null {
  const text = pounds.trim();
  const negative = text.startsWith("-");
  const parsed = parsePoundsToPence(negative ? text.slice(1) : text);
  if (!parsed.ok) return null;
  return negative ? -parsed.pence : parsed.pence;
}

/** As `poundsToPenceOrNull`, reading an unreadable amount as zero. */
export function poundsToPence(pounds: string): number {
  return poundsToPenceOrNull(pounds) ?? 0;
}
