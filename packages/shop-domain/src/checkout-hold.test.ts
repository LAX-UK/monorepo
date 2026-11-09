import { describe, expect, it } from "vitest";
import {
  CHECKOUT_HOLD_MS,
  HOLD_RECHECK_MS,
  MAX_ASYNC_PAYMENT_HOLD_MS,
  MAX_HOLD_EXTENSION_MS,
  STRIPE_SESSION_MIN_LIFETIME_MS,
  newCheckoutHoldEnd,
  planHoldDeferral,
  planSessionHold,
} from "./checkout-hold.js";

const NOW = new Date("2026-11-12T10:00:00Z");
const at = (minutes: number, from = NOW) => new Date(from.getTime() + minutes * 60_000);

describe("newCheckoutHoldEnd", () => {
  it("holds for Stripe's minimum and a minute, so a session is never refused", () => {
    expect(CHECKOUT_HOLD_MS).toBeGreaterThan(STRIPE_SESSION_MIN_LIFETIME_MS);
    expect(newCheckoutHoldEnd(NOW)).toEqual(at(31));
  });
});

describe("planSessionHold", () => {
  it("keeps a hold that is long enough, so a fresh order is written once", () => {
    // The order was created a moment ago with a 31-minute hold.
    const created = NOW;
    const justAfter = new Date(NOW.getTime() + 2_000);
    expect(
      planSessionHold({ holdEndsAt: newCheckoutHoldEnd(created), began: created, now: justAfter }),
    ).toEqual({ kind: "keep", endsAt: at(31) });
  });

  it("keeps a long hold, such as the hour after accepting a delivery quote", () => {
    expect(planSessionHold({ holdEndsAt: at(60), began: NOW, now: NOW })).toEqual({
      kind: "keep",
      endsAt: at(60),
    });
  });

  it("stretches a hold that is under the minimum, to 31 minutes from now", () => {
    expect(planSessionHold({ holdEndsAt: at(10), began: NOW, now: NOW })).toEqual({
      kind: "extend",
      endsAt: at(31),
    });
  });

  it("stretches a hold of exactly 30 minutes, which Stripe would refuse", () => {
    expect(planSessionHold({ holdEndsAt: at(30), began: NOW, now: NOW })).toMatchObject({
      kind: "extend",
    });
  });

  it("stretches a hold inside the safety margin of Stripe's minimum", () => {
    const holdEndsAt = new Date(NOW.getTime() + STRIPE_SESSION_MIN_LIFETIME_MS + 10_000);
    expect(planSessionHold({ holdEndsAt, began: NOW, now: NOW }).kind).toBe("extend");
  });

  it("allows a stretch that ends exactly at the ceiling", () => {
    const began = new Date(NOW.getTime() + CHECKOUT_HOLD_MS - MAX_HOLD_EXTENSION_MS);
    expect(planSessionHold({ holdEndsAt: at(5), began, now: NOW })).toEqual({
      kind: "extend",
      endsAt: at(31),
    });
  });

  it("refuses a stretch that would end after the ceiling", () => {
    const began = new Date(NOW.getTime() + CHECKOUT_HOLD_MS - MAX_HOLD_EXTENSION_MS - 1);
    expect(planSessionHold({ holdEndsAt: at(5), began, now: NOW })).toEqual({ kind: "refuse" });
  });

  it("never refuses a hold that is long enough, however old the order", () => {
    const began = new Date(NOW.getTime() - 10 * MAX_HOLD_EXTENSION_MS);
    expect(planSessionHold({ holdEndsAt: at(45), began, now: NOW }).kind).toBe("keep");
  });
});

describe("planHoldDeferral", () => {
  it("looks again after the recheck interval", () => {
    expect(planHoldDeferral({ began: NOW, now: at(40) })).toEqual({
      kind: "defer",
      endsAt: new Date(at(40).getTime() + HOLD_RECHECK_MS),
    });
  });

  it("allows a payment to be confirmed for days, but not past 21 days from the start", () => {
    const threeDays = new Date(NOW.getTime() + 3 * 24 * 60 * 60_000);
    expect(planHoldDeferral({ began: NOW, now: threeDays }).kind).toBe("defer");
    const cap = new Date(NOW.getTime() + MAX_ASYNC_PAYMENT_HOLD_MS);
    expect(planHoldDeferral({ began: NOW, now: cap })).toEqual({ kind: "at_cap" });
  });

  it("never defers past the ceiling, even by part of an interval", () => {
    const nearCap = new Date(NOW.getTime() + MAX_ASYNC_PAYMENT_HOLD_MS - 5 * 60_000);
    expect(planHoldDeferral({ began: NOW, now: nearCap })).toEqual({
      kind: "defer",
      endsAt: new Date(NOW.getTime() + MAX_ASYNC_PAYMENT_HOLD_MS),
    });
  });
});
