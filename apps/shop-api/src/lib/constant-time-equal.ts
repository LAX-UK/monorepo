import { timingSafeEqual } from "node:crypto";

/** Compares two secrets in constant time, so the time taken says nothing about how much matched. */
export function constantTimeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
