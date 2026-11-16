import { unappliedMoneyAggregate, unappliedMoneyPayload } from "@auction/domain";
import { describe, expect, it } from "vitest";
import { assertDemoFullTarget } from "../../runners/demo-full-cli.js";
import { assertDemoSeedDatabase, demoSeedRefusal } from "../../shared/demo-seed-target.js";
import { bookingFingerprint, firstOfferedSlot } from "./collection.seeder.js";
import { DEMO_CONSIGNMENT } from "./consignment.seeder.js";
import { QUEUE_SEEDERS, type QueueContext, type QueueSeeder, seedStaffQueues } from "./index.js";
import { DEMO_STRIPE, DEMO_VENUE, QUEUE_IDS } from "./queue-ids.js";
import { DEMO_UNAPPLIED_MONEY } from "./unapplied-money.seeder.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
/** A Monday, 09:00 in London. */
const NOW = Date.UTC(2026, 10, 16, 9, 0);

/** A database stand-in that answers the demo seed mark check. */
function markedDb(mark: { environment: string; database_name: string } | null, name = "auction") {
  const queries: string[] = [];
  return {
    queries,
    db: {
      async execute(query: { queryChunks?: unknown[] }) {
        const text = JSON.stringify(query.queryChunks ?? query);
        queries.push(text);
        if (text.includes("current_database()")) return { rows: [{ name, has_table: true }] };
        return { rows: mark ? [mark] : [] };
      },
    },
  };
}

describe("staff queue seeders", () => {
  it("fills each staff queue the demo claims, each once", () => {
    const queues = QUEUE_SEEDERS.map((s) => s.queue);
    expect(new Set(queues).size).toBe(queues.length);
    expect(queues).toEqual([
      "Purchase problems",
      "Unapplied money",
      "Disputes",
      "Data requests",
      "Collection desk and lot fulfilment",
      "Consignments awaiting review",
      "Private sales",
    ]);
  });

  it("runs the seeders in order on a marked database and reports the queues they filled", async () => {
    const calls: string[] = [];
    const fake = (queue: string): QueueSeeder => ({
      queue,
      async seed() {
        calls.push(queue);
      },
    });
    const { db } = markedDb({ environment: "test", database_name: "auction" });
    const filled = await seedStaffQueues({ db } as unknown as QueueContext, [fake("a"), fake("b")]);
    expect(calls).toEqual(["a", "b"]);
    expect(filled).toEqual(["a", "b"]);
  });

  it("refuses a database without the demo seed mark before any seeder runs", async () => {
    const never: QueueSeeder = { queue: "never", seed: async () => assertNever() };
    const { db } = markedDb(null);
    await expect(seedStaffQueues({ db } as unknown as QueueContext, [never])).rejects.toThrow(
      /not marked as a demo seed target/,
    );
  });

  it("stops at the first seeder that fails, so a half-filled queue is never reported", async () => {
    const failing: QueueSeeder = {
      queue: "bad",
      seed: async () => {
        throw new Error("boom");
      },
    };
    const never: QueueSeeder = { queue: "never", seed: async () => assertNever() };
    const { db } = markedDb({ environment: "local", database_name: "auction" });
    await expect(
      seedStaffQueues({ db } as unknown as QueueContext, [failing, never]),
    ).rejects.toThrow("boom");
  });

  it("gives every row it owns a valid, distinct fixed id", () => {
    const ids = Object.values(QUEUE_IDS).flatMap((make) => [make(1), make(2)]);
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only invented contact details and references", () => {
    expect(DEMO_VENUE.contactEmail).toMatch(/@example\.(com|test)$/);
    // ZZ99 is a pseudo-postcode that is never issued to an address.
    expect(DEMO_VENUE.postcode).toBe("ZZ99 9ZZ");
    for (const ref of Object.values(DEMO_STRIPE)) expect(ref).toMatch(/_demo_example/);
  });

  it("books the visit in the first slot the place offers, at least three days ahead", () => {
    const slot = firstOfferedSlot(NOW, 3);
    // Thursday 19 November, 10:00 in London (GMT), the first half hour of the default hours.
    expect(slot.start.toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(slot.end.getTime() - slot.start.getTime()).toBe(30 * 60_000);
    expect(slot.state).toBe("open");
    // From a Friday it moves past the weekend, when the place is closed.
    const friday = Date.UTC(2026, 10, 20, 9, 0);
    expect(firstOfferedSlot(friday, 3).start.toISOString()).toBe("2026-11-23T10:00:00.000Z");
  });

  it("stores the booking's request as a digest that ignores the order of its lots", () => {
    const request = {
      legalEntityId: "e",
      venueId: "v",
      slotStart: new Date(NOW),
      lotIds: ["b", "a"],
      collector: {
        kind: "self",
        name: "Charlotte Hayes",
        email: null,
        company: null,
        userId: null,
        authorisedByUserId: null,
      },
      bookedVia: "staff",
      bookedByUserId: "u",
      overCapacityReason: null,
    };
    const digest = bookingFingerprint(request);
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(bookingFingerprint({ ...request, lotIds: ["a", "b"] })).toBe(digest);
    expect(bookingFingerprint({ ...request, bookedByUserId: "other" })).not.toBe(digest);
  });

  it("records unapplied money exactly as the recorder would: key, aggregate and payload", () => {
    const payload = unappliedMoneyPayload(DEMO_UNAPPLIED_MONEY);
    expect(payload.dedupeKey).toBe(
      "customer_balance_unapplied:evt_demo_example_unapplied_0001:gbp",
    );
    expect(payload.currency).toBe("GBP");
    expect(unappliedMoneyAggregate(DEMO_UNAPPLIED_MONEY, payload.dedupeKey)).toEqual({
      aggregateType: "payment_group",
      aggregateId: payload.dedupeKey,
    });
  });

  it("submits a consignment with what the submit step requires", () => {
    expect(DEMO_CONSIGNMENT.title.length).toBeGreaterThan(0);
    expect(DEMO_CONSIGNMENT.images.length).toBeGreaterThanOrEqual(1);
  });
});

describe("demo seed target guard", () => {
  it("refuses a database without a mark, with the command to mark a test one", () => {
    expect(demoSeedRefusal(null, "auction")).toMatch(/insert into demo_seed_target/);
  });

  it("refuses a mark written in another database (a restored copy)", () => {
    expect(
      demoSeedRefusal({ environment: "test", databaseName: "auction_test" }, "defaultdb"),
    ).toMatch(/restored copy/);
  });

  it("refuses an unknown environment and accepts test and local", () => {
    expect(demoSeedRefusal({ environment: "production", databaseName: "x" }, "x")).toMatch(
      /unknown/,
    );
    expect(demoSeedRefusal({ environment: "test", databaseName: "x" }, "x")).toBeNull();
    expect(demoSeedRefusal({ environment: "local", databaseName: "x" }, "x")).toBeNull();
  });

  it("catches what the address check cannot: an IP address host passes the name check, the database refuses", async () => {
    const url = "postgres://u:p@10.20.30.40:25060/defaultdb";
    expect(assertDemoFullTarget({ databaseUrl: url })).toBe(url);
    const { db, queries } = markedDb(null, "defaultdb");
    await expect(assertDemoSeedDatabase(db, "demo-full")).rejects.toThrow(
      /\[demo-full\] refusing to seed/,
    );
    expect(queries.length).toBe(2);
  });

  it("refuses a database whose migrations do not have the mark table yet", async () => {
    const db = {
      execute: async () => ({ rows: [{ name: "auction", has_table: false }] }),
    };
    await expect(assertDemoSeedDatabase(db, "demo-full")).rejects.toThrow(/migration 0398/);
  });

  it("keeps the address check: production by environment or host is refused first", () => {
    expect(() =>
      assertDemoFullTarget({
        databaseUrl: "postgres://u:p@db.example.com/x",
        appEnv: "production",
      }),
    ).toThrow(/production/);
    expect(() =>
      assertDemoFullTarget({ databaseUrl: "postgres://u:p@prod-bid.example.com/x" }),
    ).toThrow(/production/);
  });
});

function assertNever(): never {
  throw new Error("this seeder must not run");
}
