import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyXeroWebhookSignature } from "./xero-webhook-signature.js";

describe("verifyXeroWebhookSignature", () => {
  it("accepts a valid X-Xero-Signature (base64 of HMAC-SHA256 binary)", () => {
    const key = "test-webhook-key";
    const raw = '{"events":[]}';
    const sig = createHmac("sha256", key).update(raw).digest("base64");
    expect(verifyXeroWebhookSignature(raw, sig, key)).toBe(true);
  });

  it("rejects wrong signature", () => {
    const key = "test-webhook-key";
    const raw = '{"events":[]}';
    expect(verifyXeroWebhookSignature(raw, "AAAA", key)).toBe(false);
  });

  it("rejects missing header or key", () => {
    expect(verifyXeroWebhookSignature("{}", undefined, "k")).toBe(false);
    expect(verifyXeroWebhookSignature("{}", "abc", "")).toBe(false);
  });
});
