import { parsePoundsToPence } from "@auction/staff-ui";

/** Pounds as the API stores them ("1250.5", "-20.00") in whole pence, exactly. */
export function poundsToPence(pounds: string): number {
  const text = pounds.trim();
  const negative = text.startsWith("-");
  const parsed = parsePoundsToPence(negative ? text.slice(1) : text);
  if (!parsed.ok) return 0;
  return negative ? -parsed.pence : parsed.pence;
}
