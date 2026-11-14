import { createHmac, timingSafeEqual } from "node:crypto";

/** The header a Zoho Books workflow webhook signs its request in. */
export const ZOHO_BOOKS_SIGNATURE_HEADER = "x-zoho-webhook-signature";

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * What a Books webhook signs: its parameters sorted by name (then value), each name followed by
 * its value, with the raw JSON body appended as received.
 */
export function zohoBooksSignedText(
  params: readonly (readonly [string, string])[],
  rawBody: string,
): string {
  const sorted = [...params].sort(([ak, av], [bk, bv]) =>
    ak === bk ? (av < bv ? -1 : av > bv ? 1 : 0) : ak < bk ? -1 : 1,
  );
  return sorted.map(([k, v]) => `${k}${v}`).join("") + rawBody;
}

/** The signature Books would send: Base64 of HMAC-SHA256 over the signed text with the secret. */
export function zohoBooksSignature(
  params: readonly (readonly [string, string])[],
  rawBody: string,
  secret: string,
): string {
  return createHmac("sha256", secret).update(zohoBooksSignedText(params, rawBody)).digest("base64");
}

/**
 * Checks a Books webhook's signature in constant time. False for a missing or malformed header and
 * for an empty secret: it never says why, and the caller treats every false alike.
 */
export function verifyZohoBooksSignature(
  params: readonly (readonly [string, string])[],
  rawBody: string,
  header: string | undefined,
  secret: string,
): boolean {
  if (!secret || !header || header.length > 128 || !BASE64.test(header)) return false;
  const expected = createHmac("sha256", secret)
    .update(zohoBooksSignedText(params, rawBody))
    .digest();
  const got = Buffer.from(header, "base64");
  // The expected length is public (a SHA-256 digest); only equal lengths reach the comparison.
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
