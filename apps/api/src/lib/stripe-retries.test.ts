import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { executeWithStripeRetries } from "./stripe-retries.js";

describe("executeWithStripeRetries", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries StripeConnectionError with backoff then succeeds on the final attempt", async () => {
    vi.useFakeTimers();
    let n = 0;
    const work = executeWithStripeRetries(async () => {
      n++;
      if (n < 3) {
        throw new Stripe.errors.StripeConnectionError({
          message: "connection",
        } as never);
      }
      return "done";
    });

    const settled = (async () => {
      await vi.advanceTimersByTimeAsync(10_000);
      return work;
    })();

    await expect(settled).resolves.toBe("done");
    expect(n).toBe(3);
  });

  it("does not retry non-retryable Stripe errors", async () => {
    let n = 0;
    await expect(
      executeWithStripeRetries(async () => {
        n++;
        throw new Stripe.errors.StripeInvalidRequestError({
          message: "bad",
          type: "invalid_request_error",
        } as never);
      }),
    ).rejects.toBeInstanceOf(Stripe.errors.StripeError);
    expect(n).toBe(1);
  });
});
