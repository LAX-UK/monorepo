import { describe, expect, it } from "vitest";
import { assertDemoFullTarget } from "../../runners/demo-full-cli.js";
import { bookingSlot } from "./collection.seeder.js";
import { QUEUE_SEEDERS, type QueueContext, type QueueSeeder, seedStaffQueues } from "./index.js";
import { DEMO_VENUE, QUEUE_IDS } from "./queue-ids.js";
import { DEMO_UNAPPLIED_MONEY } from "./unapplied-money.seeder.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const NOW = Date.UTC(2026, 10, 16, 9, 0);

describe("staff queue seeders", () => {
  it("fills every staff queue the demo needs, each once", () => {
    const queues = QUEUE_SEEDERS.map((s) => s.queue);
    expect(new Set(queues).size).toBe(queues.length);
    expect(queues).toEqual([
      "Purchase problems",
      "Unapplied money",
      "Disputes",
      "Data requests",
      "Collection bookings and storage",
      "Consignments awaiting review",
      "Private sales",
      "Quarantined enquiry replies",
    ]);
  });

  it("runs the seeders in order and reports the queues they filled", async () => {
    const calls: string[] = [];
    const fake = (queue: string): QueueSeeder => ({
      queue,
      async seed() {
        calls.push(queue);
      },
    });
    const filled = await seedStaffQueues({} as QueueContext, [fake("a"), fake("b")]);
    expect(calls).toEqual(["a", "b"]);
    expect(filled).toEqual(["a", "b"]);
  });

  it("stops at the first seeder that fails, so a half-filled queue is never reported", async () => {
    const failing: QueueSeeder = {
      queue: "bad",
      seed: async () => {
        throw new Error("boom");
      },
    };
    const never: QueueSeeder = { queue: "never", seed: async () => assertNever() };
    await expect(seedStaffQueues({} as QueueContext, [failing, never])).rejects.toThrow("boom");
  });

  it("gives every row a valid, distinct fixed id", () => {
    const ids = Object.values(QUEUE_IDS).flatMap((make) => [make(1), make(2)]);
    for (const id of ids) expect(id).toMatch(UUID);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only invented contact details", () => {
    expect(DEMO_VENUE.contactEmail).toMatch(/@example\.(com|test)$/);
    expect(JSON.stringify(DEMO_UNAPPLIED_MONEY)).not.toMatch(/\b(cus|ch|pi)_[A-Za-z0-9]{14,}/);
  });

  it("books the collection visit ten in the morning, three days ahead, for half an hour", () => {
    const { start, end } = bookingSlot(NOW, 3);
    expect(start.toISOString()).toBe("2026-11-19T10:00:00.000Z");
    expect(end.getTime() - start.getTime()).toBe(30 * 60_000);
  });

  it("is only reachable through the demo seed's production guard", () => {
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
