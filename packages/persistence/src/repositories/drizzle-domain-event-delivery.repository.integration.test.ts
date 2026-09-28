import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent, domainEventDelivery } from "@auction/db/schema";
import { eq } from "drizzle-orm";
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
});
