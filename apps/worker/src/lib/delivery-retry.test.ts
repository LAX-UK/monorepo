import { describe, expect, it } from "vitest";
import { classifyDeliveryError, computeDeliveryBackoffMs } from "./delivery-retry.js";

describe("classifyDeliveryError", () => {
  it("treats retryable HTTP statuses as retryable", () => {
    expect(classifyDeliveryError({ status: 429 })).toBe("retryable");
    expect(classifyDeliveryError({ status: 503 })).toBe("retryable");
  });

  it("treats validation-style HTTP errors as fatal", () => {
    expect(classifyDeliveryError({ status: 400 })).toBe("fatal");
    expect(classifyDeliveryError({ status: 422 })).toBe("fatal");
  });

  it("treats network error codes as retryable", () => {
    expect(classifyDeliveryError({ code: "ETIMEDOUT" })).toBe("retryable");
    expect(classifyDeliveryError({ code: "ECONNRESET" })).toBe("retryable");
  });
});

describe("computeDeliveryBackoffMs", () => {
  it("stays within configured bounds", () => {
    const delay = computeDeliveryBackoffMs(3, {
      baseMs: 100,
      maxMs: 500,
      jitterRatio: 0,
    });
    expect(delay).toBeGreaterThanOrEqual(100);
    expect(delay).toBeLessThanOrEqual(500);
  });
});
