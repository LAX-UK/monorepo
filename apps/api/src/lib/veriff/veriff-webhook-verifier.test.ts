import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { VeriffWebhookSignatureError, VeriffWebhookVerifier } from "./veriff-webhook-verifier.js";

describe("VeriffWebhookVerifier", () => {
  const apiKey = "test-api-key";
  const secret = "test-shared-secret";
  const verifier = new VeriffWebhookVerifier(apiKey, secret);

  function sign(body: string): string {
    return createHmac("sha256", secret).update(body).digest("hex");
  }

  it("accepts valid signature and auth client", () => {
    const body = '{"status":"success"}';
    expect(() => verifier.verify(body, sign(body), apiKey)).not.toThrow();
  });

  it("rejects invalid auth client", () => {
    const body = '{"status":"success"}';
    expect(() => verifier.verify(body, sign(body), "wrong-key")).toThrow(
      VeriffWebhookSignatureError,
    );
  });

  it("rejects missing auth client", () => {
    const body = '{"status":"success"}';
    expect(() => verifier.verify(body, sign(body), undefined)).toThrow(VeriffWebhookSignatureError);
  });
});
