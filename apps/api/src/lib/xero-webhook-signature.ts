import { createHmac, timingSafeEqual } from "node:crypto";

/** Xero sends `X-Xero-Signature` as base64 HMAC-SHA256 of the raw body using the webhook signing key. */
export function verifyXeroWebhookSignature(
  rawBody: string,
  signatureHeader: string | undefined,
  webhookKey: string,
): boolean {
  if (!signatureHeader || !webhookKey) return false;
  const expected = createHmac("sha256", webhookKey).update(rawBody).digest();
  let got: Buffer;
  try {
    got = Buffer.from(signatureHeader, "base64");
  } catch {
    return false;
  }
  if (expected.length !== got.length) return false;
  return timingSafeEqual(expected, got);
}
