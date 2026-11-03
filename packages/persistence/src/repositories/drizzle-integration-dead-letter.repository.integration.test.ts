import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent, domainEventDelivery, failedJobs, webhookEvent } from "@auction/db/schema";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { IntegrationSearch } from "../interfaces/integration-dead-letter.reader.js";
import { DrizzleIntegrationDeadLetterRepository } from "./drizzle-integration-dead-letter.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const everything: IntegrationSearch["scope"] = { deliveries: null, webhooks: null };
const search = (patch: Partial<IntegrationSearch> = {}): IntegrationSearch => ({
  view: "needs_review",
  sort: "failed_desc",
  limit: 100,
  offset: 0,
  scope: everything,
  ...patch,
});

describe.skipIf(!HAS_DB)("DrizzleIntegrationDeadLetterRepository (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const repo = new DrizzleIntegrationDeadLetterRepository(db);
  const tag = randomUUID().slice(0, 8);
  const eventKey = `evt-${tag}`;
  const created: { eventIds: number[]; webhookIds: string[]; decisionIds: string[] } = {
    eventIds: [],
    webhookIds: [],
    decisionIds: [],
  };

  async function deadLetter(
    consumer: string,
    status: "dead_lettered" | "succeeded" = "dead_lettered",
  ) {
    const [event] = await db
      .insert(domainEvent)
      .values({
        eventType: "payment.captured",
        aggregateType: "payment",
        aggregateId: `pay-${tag}`,
        schemaVersion: 1,
        payload: { paymentId: `pay-${tag}`, buyerEmail: "lena@north.com" },
        occurredAt: new Date(),
        producer: "apps/api",
      })
      .returning({ id: domainEvent.id });
    if (!event) throw new Error("event not created");
    created.eventIds.push(event.id);
    const [delivery] = await db
      .insert(domainEventDelivery)
      .values({
        consumer,
        eventId: event.id,
        status,
        attempts: 6,
        lastError: "Xero rejected the invoice",
      })
      .returning({ id: domainEventDelivery.id });
    if (!delivery) throw new Error("delivery not created");
    const id = `delivery:${delivery.id}`;
    created.decisionIds.push(id);
    return { id, deliveryId: delivery.id };
  }

  afterAll(async () => {
    if (created.decisionIds.length) {
      await db.delete(failedJobs).where(inArray(failedJobs.id, created.decisionIds));
    }
    if (created.webhookIds.length) {
      await db.delete(webhookEvent).where(inArray(webhookEvent.id, created.webhookIds));
    }
    if (created.eventIds.length) {
      await db.delete(domainEvent).where(inArray(domainEvent.id, created.eventIds));
    }
  });

  it("lists a dead-lettered delivery with its event type, and finds it with its payload", async () => {
    const { id } = await deadLetter(`xero-${tag}`);
    const result = await repo.search(search({ q: id }));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id,
      kind: "delivery",
      eventType: "payment.captured",
      failing: true,
      attempts: 6,
    });
    const found = await repo.findForReview(id);
    expect(found?.payload).toMatchObject({ paymentId: `pay-${tag}` });
  });

  it("limits what is read to the consumers the caller may see", async () => {
    const xero = await deadLetter(`xero-${tag}`);
    const zoho = await deadLetter(`zoho-${tag}`);
    const onlyXero = await repo.search(
      search({
        q: tag,
        scope: { deliveries: { mode: "in", names: [`xero-${tag}`] }, webhooks: null },
      }),
    );
    const ids = onlyXero.rows.map((row) => row.id);
    expect(ids).toContain(xero.id);
    expect(ids).not.toContain(zoho.id);
    const none = await repo.search(
      search({
        scope: { deliveries: { mode: "in", names: [] }, webhooks: { mode: "in", names: [] } },
      }),
    );
    expect(none.rows).toEqual([]);
  });

  it("does not list a delivery that went through", async () => {
    const { id } = await deadLetter(`xero-${tag}`, "succeeded");
    expect((await repo.search(search({ q: id }))).rows).toEqual([]);
  });

  it("reads a failed webhook and starts it over", async () => {
    const [row] = await db
      .insert(webhookEvent)
      .values({
        source: `stripe-${tag}`,
        eventKey,
        payload: { type: "checkout.session.completed", id: "evt_1" },
        attempts: 2,
        lastError: "Handler timed out",
      })
      .returning({ id: webhookEvent.id });
    if (!row) throw new Error("webhook not created");
    created.webhookIds.push(row.id);
    created.decisionIds.push(`webhook:${row.id}`);

    const listed = await repo.search(search({ q: eventKey }));
    expect(listed.rows[0]).toMatchObject({
      kind: "webhook",
      eventType: "checkout.session.completed",
      eventKey,
    });
    expect(
      (await repo.listFailedWebhooks({ limit: 500, offset: 0 })).map((w) => w.eventKey),
    ).toContain(eventKey);

    await repo.requeue(eventKey);
    const [after] = await db.select().from(webhookEvent).where(eq(webhookEvent.id, row.id));
    expect(after?.lastError).toBeNull();
    expect((await repo.search(search({ q: eventKey }))).rows).toEqual([]);
  });

  it("lets one of two simultaneous retries claim it, then retried shows in its own view", async () => {
    const { id } = await deadLetter(`xero-${tag}`);
    const record = (await repo.findManyForReview([id]))[0];
    if (!record) throw new Error("not found");
    const seed = {
      id,
      attempts: record.attempts,
      failedAt: record.failedAt,
      firstFailedAt: record.firstFailedAt,
    };
    const claims = await Promise.all([repo.claimRetry(seed, "u1"), repo.claimRetry(seed, "u2")]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    expect(await repo.claimRetry(seed, "u3")).toBe(false);

    // Replayed: the delivery is back in flight, so it leaves Needs review for Retried.
    await db
      .update(domainEventDelivery)
      .set({ status: "pending" })
      .where(eq(domainEventDelivery.id, Number(id.split(":")[1])));
    expect((await repo.search(search({ q: id }))).rows).toEqual([]);
    const retried = await repo.search(search({ view: "retried", q: id }));
    expect(retried.rows).toHaveLength(1);
    expect(retried.rows[0]?.replayedAt).not.toBeNull();
  });

  it("gives a claim back so the retry can be tried again", async () => {
    const { id } = await deadLetter(`xero-${tag}`);
    const record = (await repo.findManyForReview([id]))[0];
    if (!record) throw new Error("not found");
    const seed = {
      id,
      attempts: record.attempts,
      failedAt: record.failedAt,
      firstFailedAt: record.firstFailedAt,
    };
    expect(await repo.claimRetry(seed, "u1")).toBe(true);
    await repo.releaseRetry(id);
    expect(await repo.claimRetry(seed, "u2")).toBe(true);
  });

  it("discards with a reason, keeps it out of Needs review, and restores it", async () => {
    const { id } = await deadLetter(`xero-${tag}`);
    const record = (await repo.findManyForReview([id]))[0];
    if (!record) throw new Error("not found");
    const seed = {
      id,
      attempts: record.attempts,
      failedAt: record.failedAt,
      firstFailedAt: record.firstFailedAt,
    };
    expect(
      await repo.discard({ seeds: [seed], byUserId: "u1", reason: "duplicate", note: null }),
    ).toEqual([id]);
    expect(
      await repo.discard({ seeds: [seed], byUserId: "u2", reason: "duplicate", note: null }),
    ).toEqual([]);
    expect((await repo.search(search({ q: id }))).rows).toEqual([]);
    const discarded = await repo.search(search({ view: "discarded", q: id }));
    expect(discarded.rows[0]).toMatchObject({ discardReason: "duplicate", discardedBy: "u1" });
    expect(await repo.claimRetry(seed, "u1")).toBe(false);

    expect(await repo.restore([id])).toEqual([id]);
    expect((await repo.search(search({ q: id }))).rows).toHaveLength(1);
  });

  it("keeps decisions on integration deliveries out of the background jobs store", async () => {
    const { id } = await deadLetter(`xero-${tag}`);
    const record = (await repo.findManyForReview([id]))[0];
    if (!record) throw new Error("not found");
    await repo.claimRetry(
      { id, attempts: 1, failedAt: record.failedAt, firstFailedAt: record.firstFailedAt },
      "u1",
    );
    const { DrizzleFailedJobReviewRepository } = await import(
      "./drizzle-failed-job-review.repository.js"
    );
    const background = new DrizzleFailedJobReviewRepository(db);
    const result = await background.search({
      view: "retried",
      sort: "failed_desc",
      limit: 100,
      offset: 0,
      q: id,
    });
    expect(result.rows).toEqual([]);
  });
});
