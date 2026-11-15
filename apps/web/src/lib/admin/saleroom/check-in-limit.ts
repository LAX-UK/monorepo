import { poundsToPenceOrNull } from "@/lib/admin/seller-proceeds/pounds";

export const CHECK_IN_LIMIT_ERROR =
  "Enter the maximum hammer as an amount, such as 5,000 or 2500.50.";

export type CheckInLimit = { ok: true; pence: number | null } | { ok: false };

/** The typed check-in limit in pence: blank means no cap; unreadable, zero or negative is refused. */
export function parseCheckInLimit(text: string): CheckInLimit {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: true, pence: null };
  const pence = poundsToPenceOrNull(trimmed);
  if (pence === null || pence <= 0) return { ok: false };
  return { ok: true, pence };
}
