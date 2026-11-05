import type { Database } from "@auction/db";
import { describe, expect, it, vi } from "vitest";
import type { ShopAlertSubscriberErasure } from "../../application/ports/shop-alert-subscriber-erasure.js";
import { createDrizzleGuestErasureStore } from "./drizzle-guest-erasure.store.js";

const GUEST_ID = "2f0b6d7e-0000-4000-8000-000000000001";
const NOW = new Date("2026-11-05T09:00:00Z");

type Query = Promise<unknown[]> & {
  from: () => Query;
  where: () => Query;
  leftJoin: () => Query;
  limit: () => Promise<unknown[]> & { for: () => Promise<unknown[]> };
};

/** A transaction where the guest exists with no orders and every write finds nothing to change. */
function fakeDb() {
  let selects = 0;
  const writes: Record<string, unknown> = {};
  for (const method of ["set", "values", "where", "returning"]) {
    writes[method] = () => Object.assign(Promise.resolve([]), writes);
  }
  const read = () => {
    selects += 1;
    return selects === 1
      ? [{ id: GUEST_ID, email: "ada@example.com", erasedAt: null, claimedAt: null }]
      : [];
  };
  const select = () => {
    const rows = read();
    const query: Query = Object.assign(Promise.resolve(rows), {
      from: () => query,
      where: () => query,
      leftJoin: () => query,
      limit: () => Object.assign(Promise.resolve(rows), { for: () => Promise.resolve(rows) }),
    });
    return query;
  };
  const tx = { select, update: () => writes, delete: () => writes, insert: () => writes };
  return { transaction: async (work: (t: unknown) => unknown) => work(tx) } as unknown as Database;
}

describe("guest erasure store: alert subscriptions", () => {
  const work = async (alerts: ShopAlertSubscriberErasure) => {
    const store = createDrizzleGuestErasureStore(fakeDb(), { domainEventMode: "off", alerts });
    return store.withLockedGuest(GUEST_ID, async (_guest, erase) =>
      erase({ actorSubjectId: "staff-1", reason: "Asked to be forgotten", now: NOW }),
    );
  };

  it("erases the guest's alert subscriptions by their email, inside the transaction, and counts them", async () => {
    const erase = vi.fn(async () => ({
      alertSubscribers: 2,
      releaseAlerts: 1,
      suppressionsKept: 1,
    }));
    const counts = await work({ erase });
    expect(erase).toHaveBeenCalledTimes(1);
    expect(erase).toHaveBeenCalledWith(expect.anything(), { emails: ["ada@example.com"] });
    expect(counts).toMatchObject({ alertSubscribers: 2, releaseAlerts: 1, suppressionsKept: 1 });
  });

  it("reports zero when a repeat finds nothing left", async () => {
    const counts = await work({
      erase: async () => ({ alertSubscribers: 0, releaseAlerts: 0, suppressionsKept: 0 }),
    });
    expect(counts).toMatchObject({ alertSubscribers: 0, releaseAlerts: 0, suppressionsKept: 0 });
  });
});
