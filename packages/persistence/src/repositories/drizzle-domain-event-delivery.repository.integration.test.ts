import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent, domainEventDelivery } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DrizzleDomainEventDeliveryRepository } from "./drizzle-domain-event-delivery.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)("DrizzleDomainEventDeliveryRepository (integration)", () => {
  it("replays skipped deliveries for selected event types", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const repo = new DrizzleDomainEventDeliveryRepository(db);
    const subjectId = randomUUID();

    const [event] = await db
      .insert(domainEvent)
      .values({
        eventType: "user.registered",
        aggregateType: "user",
        aggregateId: subjectId,
        schemaVersion: 1,
        payload: {
          userId: subjectId,
          email: "replay-test@example.com",
          name: "Replay Test",
          source: "credential",
        },
        occurredAt: new Date(),
        producer: "apps/auth",
      })
      .returning({ id: domainEvent.id });

    await repo.ensurePending({
      consumer: "zoho",
      eventId: event.id,
      idempotencyKey: `zoho:replay-${event.id}`,
    });

    const [delivery] = await db
      .select()
      .from(domainEventDelivery)
      .where(eq(domainEventDelivery.eventId, event.id))
      .limit(1);
    if (!delivery) throw new Error("delivery_missing");

    await repo.markSkipped({ deliveryId: delivery.id, reason: "dry_run" });

    const replayed = await repo.replaySkippedForEventTypes({
      consumer: "zoho",
      eventTypes: ["user.registered"],
      limit: 10,
    });

    expect(replayed).toBe(1);

    const [row] = await db
      .select()
      .from(domainEventDelivery)
      .where(eq(domainEventDelivery.id, delivery.id));
    expect(row?.status).toBe("pending");
  });

  it("never claims a dry-run skip again until it is put back, and puts back only that reason", async () => {
    // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
    const db = createDb(process.env.DATABASE_URL!);
    const repo = new DrizzleDomainEventDeliveryRepository(db);
    const consumer = `zoho_catch_up_probe_${randomUUID().slice(0, 8)}`;
    const otherConsumer = `${consumer}_other`;
    const eventTypes = ["artwork_register.offer_changed"];

    async function skippedDelivery(onConsumer: string, reason: string): Promise<number> {
      const registerId = randomUUID();
      const [event] = await db
        .insert(domainEvent)
        .values({
          eventType: "artwork_register.offer_changed",
          aggregateType: "artwork_register",
          aggregateId: registerId,
          schemaVersion: 1,
          payload: { registerId },
          occurredAt: new Date(),
          producer: "test",
        })
        .returning({ id: domainEvent.id });
      if (!event) throw new Error("event_missing");
      await repo.ensurePending({
        consumer: onConsumer,
        eventId: event.id,
        idempotencyKey: `${onConsumer}:${event.id}`,
      });
      const [delivery] = await db
        .select()
        .from(domainEventDelivery)
        .where(eq(domainEventDelivery.eventId, event.id));
      if (!delivery) throw new Error("delivery_missing");
      const [claimed] = await repo.claim({ consumer: onConsumer, batchSize: 1, leaseMs: 60_000 });
      expect(Number(claimed?.id)).toBe(delivery.id);
      await repo.markSkipped({ deliveryId: delivery.id, reason });
      return delivery.id;
    }

    const dryRunA = await skippedDelivery(consumer, "dry_run");
    const dryRunB = await skippedDelivery(consumer, "dry_run");
    const inSync = await skippedDelivery(consumer, "status_already_in_sync");
    const otherDryRun = await skippedDelivery(otherConsumer, "dry_run");

    // The problem: once skipped as a dry run, the live worker never claims the delivery again.
    expect(await repo.claim({ consumer, batchSize: 10, leaseMs: 60_000 })).toEqual([]);

    const filter = { consumer, eventTypes, reason: "dry_run" };
    expect(await repo.countSkippedForEventTypes(filter)).toBe(2);
    expect(await repo.countSkippedForEventTypes({ consumer, eventTypes })).toBe(3);
    expect(await repo.countSkippedForEventTypes({ ...filter, eventTypes: ["lot.created"] })).toBe(
      0,
    );

    expect(await repo.replaySkippedForEventTypes({ ...filter, limit: 1 })).toBe(1);
    expect(await repo.replaySkippedForEventTypes({ ...filter, limit: 10 })).toBe(1);
    expect(await repo.replaySkippedForEventTypes({ ...filter, limit: 10 })).toBe(0);
    expect(await repo.countSkippedForEventTypes(filter)).toBe(0);

    const claimed = await repo.claim({ consumer, batchSize: 10, leaseMs: 60_000 });
    expect(claimed.map((d) => Number(d.id)).sort((a, b) => a - b)).toEqual([dryRunA, dryRunB]);

    const untouched = await db
      .select({ id: domainEventDelivery.id, status: domainEventDelivery.status })
      .from(domainEventDelivery)
      .where(inArray(domainEventDelivery.id, [inSync, otherDryRun]));
    expect(untouched.every((row) => row.status === "skipped")).toBe(true);
  });
});
