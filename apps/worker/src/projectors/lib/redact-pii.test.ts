import { describe, expect, it } from "vitest";
import { redactDomainEventPayload } from "./redact-pii.js";

describe("worker redact-pii re-export", () => {
  it("delegates to shared policy", () => {
    const out = redactDomainEventPayload("payment.captured", {
      paymentId: "p1",
      buyerEmail: "a@b.com",
      internal: "secret",
    }) as Record<string, unknown>;
    expect(out.buyerEmail).toBe("a@b.com");
    expect(out.internal).toBe("[REDACTED]");
  });
});
