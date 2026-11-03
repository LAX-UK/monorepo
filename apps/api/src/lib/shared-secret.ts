import { timingSafeEqual } from "node:crypto";

/**
 * Compares a secret sent in a header with the configured one. The lengths are compared first
 * (timingSafeEqual refuses unequal lengths), then the bytes in constant time.
 */
export function sharedSecretMatches(provided: string | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const got = Buffer.from(provided, "utf8");
  const want = Buffer.from(expected, "utf8");
  if (got.length !== want.length) return false;
  return timingSafeEqual(got, want);
}
