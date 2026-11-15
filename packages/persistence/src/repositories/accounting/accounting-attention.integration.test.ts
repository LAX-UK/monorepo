import { randomUUID } from "node:crypto";
import { closeDb, createDb } from "@auction/db";
import { domainEvent, domainEventDelivery } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { DrizzleAccountingAttentionReader } from "./drizzle-accounting-attention.reader.js";

const OWNER_URL = process.env.DATABASE_URL;
const WORKER_URL = process.env.DATABASE_URL_WORKER;
const HAS_DB = Boolean(OWNER_URL);

const HOUR = 60 * 60_000;
const NOW = Date.parse("2031-04-01T12:00:00Z");
const WAITING = "accounting_projection_not_yet:credit_in_flight:LAX-BID-CN-7";

describe.skipIf(!HAS_DB)("accounting attention: stuck refund reversals (integration)", () => {
  const owner = createDb(OWNER_URL as string);
  const worker = createDb(WORKER_URL || (OWNER_URL as string));
  const reader = new DrizzleAccountingAttentionReader(worker);
  const eventIds: number[] = [];

  afterAll(async () => {
    if (eventIds.length > 0)
      await owner.delete(domainEvent).where(inArray(domainEvent.id, eventIds));
    await closeDb(owner);
    await closeDb(worker);
  });

  async function delivery(input: {
    eventType: string;
    consumer?: string;
    status?: "pending" | "processing" | "retryable" | "dead_lettered" | "succeeded";
    lastError?: string | null;
    queuedHoursAgo: number;
  }): Promise<number> {
    const [event] = await owner
      .insert(domainEvent)
      .values({
        aggregateType: "payment",
        aggregateId: randomUUID(),
        eventType: input.eventType,
        payload: {},
        producer: "test",
      })
      .returning({ id: domainEvent.id });
    if (!event) throw new Error("no event");
    eventIds.push(event.id);
    const [row] = await owner
      .insert(domainEventDelivery)
      .values({
        consumer: input.consumer ?? "accounting",
        eventId: event.id,
        status: input.status ?? "retryable",
        lastError: input.lastError === undefined ? WAITING : input.lastError,
        createdAt: new Date(NOW - input.queuedHoursAgo * HOUR),
      })
      .returning({ id: domainEventDelivery.id });
    if (!row) throw new Error("no delivery");
    return row.id;
  }

  it("lists reversals waiting on a credit note past the threshold, oldest first, and nothing else", async () => {
    const older = await delivery({ eventType: "payment.refund_reversed", queuedHoursAgo: 9 });
    const old = await delivery({ eventType: "shop.refund.reversed", queuedHoursAgo: 7 });
    const group = await delivery({
      eventType: "payment_group.refund_reversed",
      status: "pending",
      queuedHoursAgo: 8,
    });
    // Not stuck long enough, not waiting on a credit note, settled, dead-lettered, another
    // consumer, or not a reversal: none listed.
    const ignored = [
      await delivery({ eventType: "payment.refund_reversed", queuedHoursAgo: 5 }),
      await delivery({
        eventType: "payment.refund_reversed",
        lastError: "accounting_projection_not_yet:credit_missing:LAX-BID-CN-7",
        queuedHoursAgo: 9,
      }),
      await delivery({ eventType: "payment.refund_reversed", lastError: null, queuedHoursAgo: 9 }),
      await delivery({
        eventType: "payment.refund_reversed",
        status: "succeeded",
        queuedHoursAgo: 9,
      }),
      await delivery({
        eventType: "payment.refund_reversed",
        status: "dead_lettered",
        queuedHoursAgo: 9,
      }),
      await delivery({ eventType: "payment.refund_reversed", consumer: "xero", queuedHoursAgo: 9 }),
      await delivery({ eventType: "payment.refunded", queuedHoursAgo: 9 }),
    ];

    const stuck = await reader.stuckRefundReversals(new Date(NOW - 6 * HOUR), 1_000);
    const mine = stuck.filter((s) => eventIds.includes(s.eventId));
    expect(mine.map((s) => s.deliveryId)).toEqual([older, group, old]);
    expect(mine.some((s) => ignored.includes(s.deliveryId))).toBe(false);
    expect(mine[0]).toMatchObject({
      eventType: "payment.refund_reversed",
      waitingSince: new Date(NOW - 9 * HOUR),
      lastError: WAITING,
    });
  });
});
