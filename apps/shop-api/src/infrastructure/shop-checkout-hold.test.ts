import { describe, expect, it, vi } from "vitest";
import {
  MAX_HOLD_EXTENSION_MS,
  STRIPE_SESSION_MIN_LIFETIME_MS,
  holdForNewSession,
  newCheckoutHoldEnd,
  sessionEndFor,
} from "./shop-checkout-hold.js";

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

describe("newCheckoutHoldEnd", () => {
  it("holds a new checkout for Stripe's minimum with a minute spare, so UK sessions are never refused", () => {
    expect(newCheckoutHoldEnd(NOW).getTime()).toBe(NOW.getTime() + 31 * 60_000);
    expect(newCheckoutHoldEnd(NOW).getTime() - NOW.getTime()).toBeGreaterThan(30 * 60_000);
  });
});

describe("holdForNewSession", () => {
  const dbWith = () => {
    const updates: unknown[] = [];
    const tx = {
      update: vi.fn(() => ({
        set: vi.fn((values: unknown) => {
          updates.push(values);
          return { where: vi.fn(() => ({ returning: vi.fn(async () => [{ id: "order-1" }]) })) };
        }),
      })),
    };
    return {
      updates,
      db: { transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)) },
    };
  };
  const order = (minutesLeft: number) => ({
    id: "order-1",
    checkoutExpiresAt: new Date(NOW.getTime() + minutesLeft * 60_000),
  });

  it("leaves a hold that is long enough alone", async () => {
    const { db, updates } = dbWith();
    const hold = await holdForNewSession(db as never, order(45), { began: NOW, now: NOW });
    expect(hold.getTime()).toBe(NOW.getTime() + 45 * 60_000);
    expect(updates).toEqual([]);
  });

  it("stretches a short hold, moving the order and the reservation together", async () => {
    const { db, updates } = dbWith();
    const hold = await holdForNewSession(db as never, order(10), { began: NOW, now: NOW });
    expect(hold.getTime()).toBe(NOW.getTime() + 31 * 60_000);
    // The order's hold, then the editions' reservation (the hold plus the one-minute grace).
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ checkoutExpiresAt: hold });
    expect(updates[1]).toMatchObject({ reservedUntil: new Date(hold.getTime() + 60_000) });
  });

  it("refuses to stretch a hold beyond two hours after it began, and changes nothing", async () => {
    const { db, updates } = dbWith();
    const began = new Date(NOW.getTime() - MAX_HOLD_EXTENSION_MS);
    await expect(
      holdForNewSession(db as never, order(5), { began, now: NOW }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(updates).toEqual([]);
  });

  it("allows a stretch that ends exactly at the ceiling", async () => {
    const { db } = dbWith();
    const began = new Date(NOW.getTime() + 31 * 60_000 - MAX_HOLD_EXTENSION_MS);
    const hold = await holdForNewSession(db as never, order(5), { began, now: NOW });
    expect(hold.getTime()).toBe(began.getTime() + MAX_HOLD_EXTENSION_MS);
  });
});
