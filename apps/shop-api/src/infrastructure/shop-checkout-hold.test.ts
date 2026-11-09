import { describe, expect, it, vi } from "vitest";
import { holdForNewSession } from "./shop-checkout-hold.js";

const NOW = new Date("2026-11-12T10:00:00Z");
const at = (minutes: number, from = NOW) => new Date(from.getTime() + minutes * 60_000);

function dbWith(options: { moves?: boolean } = {}) {
  const updates: unknown[] = [];
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: unknown) => {
        updates.push(values);
        return {
          where: vi.fn(() => ({
            returning: vi.fn(async () => (options.moves === false ? [] : [{ id: "order-1" }])),
          })),
        };
      }),
    })),
  };
  return {
    updates,
    db: { transaction: vi.fn(async (fn: (inner: typeof tx) => Promise<unknown>) => fn(tx)) },
  };
}

const order = (minutesLeft: number) => ({ id: "order-1", checkoutExpiresAt: at(minutesLeft) });
const ordinary = { began: NOW, now: NOW, isQuote: false };

describe("holdForNewSession", () => {
  it("leaves a hold that is long enough alone, writing nothing", async () => {
    const { db, updates } = dbWith();
    const hold = await holdForNewSession(db as never, order(45), ordinary);
    expect(hold).toEqual(at(45));
    expect(updates).toEqual([]);
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("writes nothing for a fresh order, whose hold was set a moment ago", async () => {
    const { db } = dbWith();
    const created = NOW;
    const hold = await holdForNewSession(
      db as never,
      { id: "order-1", checkoutExpiresAt: at(31, created) },
      { began: created, now: new Date(created.getTime() + 1_500), isQuote: false },
    );
    expect(hold).toEqual(at(31, created));
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("stretches a short hold, moving the order and the reservation together", async () => {
    const { db, updates } = dbWith();
    const hold = await holdForNewSession(db as never, order(10), ordinary);
    expect(hold).toEqual(at(31));
    // The order's hold, then the editions' reservation (the hold plus the one-minute grace).
    expect(updates).toHaveLength(2);
    expect(updates[0]).toMatchObject({ checkoutExpiresAt: hold });
    expect(updates[1]).toMatchObject({ reservedUntil: new Date(hold.getTime() + 60_000) });
  });

  it("refuses a stretch past two hours, changing nothing, and says what happens next", async () => {
    const { db, updates } = dbWith();
    const began = at(-120);
    await expect(
      holdForNewSession(db as never, order(5), { began, now: NOW, isQuote: false }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("basket restored"),
    });
    expect(updates).toEqual([]);
  });

  it("tells a quote buyer to ask for a new delivery quote rather than go to an empty basket", async () => {
    const { db } = dbWith();
    await expect(
      holdForNewSession(db as never, order(5), { began: at(-120), now: NOW, isQuote: true }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("new delivery quote"),
    });
  });

  it("refuses when the hold had already ended, writing no reservation", async () => {
    const { db, updates } = dbWith({ moves: false });
    await expect(holdForNewSession(db as never, order(10), ordinary)).rejects.toMatchObject({
      statusCode: 409,
    });
    // Only the order was tried; the reservation is not touched when the order did not move.
    expect(updates).toHaveLength(1);
  });
});
