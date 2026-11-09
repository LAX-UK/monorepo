import { describe, expect, it } from "vitest";
import { STRIPE_SESSION_MIN_LIFETIME_MS, sessionEndFor } from "./shop-checkout-hold.js";

const NOW = new Date("2026-11-12T10:00:00Z");

describe("sessionEndFor", () => {
  it("keeps a hold that already lasts long enough", () => {
    const hold = new Date(NOW.getTime() + 60 * 60_000);
    expect(sessionEndFor(hold, NOW)).toBe(hold);
  });

  it("stretches a shorter hold to Stripe's minimum with a minute to spare", () => {
    const hold = new Date(NOW.getTime() + 10 * 60_000);
    expect(sessionEndFor(hold, NOW).getTime()).toBe(NOW.getTime() + 31 * 60_000);
    expect(STRIPE_SESSION_MIN_LIFETIME_MS).toBeGreaterThan(30 * 60_000);
  });

  it("stretches a hold that is exactly 30 minutes, which Stripe would refuse", () => {
    const hold = new Date(NOW.getTime() + 30 * 60_000);
    expect(sessionEndFor(hold, NOW).getTime()).toBe(NOW.getTime() + 31 * 60_000);
  });
});
