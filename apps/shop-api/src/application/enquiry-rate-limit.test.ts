import { describe, expect, it } from "vitest";
import { createInMemoryFixedWindowCounter } from "../infrastructure/in-memory-fixed-window-counter.js";
import { ENQUIRY_RATE_LIMITS, createEnquiryRateLimiter } from "./enquiry-rate-limit.js";

describe("createEnquiryRateLimiter", () => {
  it("allows each sender five enquiries an hour", async () => {
    const limiter = createEnquiryRateLimiter(createInMemoryFixedWindowCounter());
    for (let attempt = 0; attempt < ENQUIRY_RATE_LIMITS.perSender.max; attempt += 1) {
      await expect(limiter.consume({ clientIp: null, senderKey: "email:a@x.io" })).resolves.toEqual(
        { allowed: true },
      );
    }
    await expect(limiter.consume({ clientIp: null, senderKey: "email:a@x.io" })).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 3600,
    });
    await expect(limiter.consume({ clientIp: null, senderKey: "email:b@x.io" })).resolves.toEqual({
      allowed: true,
    });
  });

  it("blocks one client IP after ten enquiries even across different senders", async () => {
    const limiter = createEnquiryRateLimiter(createInMemoryFixedWindowCounter());
    for (let attempt = 0; attempt < ENQUIRY_RATE_LIMITS.perClientIp.max; attempt += 1) {
      const decision = await limiter.consume({
        clientIp: "203.0.113.9",
        senderKey: `email:${attempt}@x.io`,
      });
      expect(decision.allowed).toBe(true);
    }
    const blocked = await limiter.consume({ clientIp: "203.0.113.9", senderKey: "email:new@x.io" });
    expect(blocked.allowed).toBe(false);
  });
});
