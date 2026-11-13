import { randomUUID } from "node:crypto";
import { createDb } from "@auction/db";
import { domainEvent, domainEventDelivery, failedJobs, webhookEvent } from "@auction/db/schema";
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import type { FailedJobNeedsReviewGroup } from "../interfaces/failed-job-review.js";
import { DrizzleFailedJobReviewRepository } from "./drizzle-failed-job-review.repository.js";
import { DrizzleIntegrationDeadLetterRepository } from "./drizzle-integration-dead-letter.repository.js";

const HAS_DB = Boolean(process.env.DATABASE_URL);

const HOUR = 3_600_000;

describe.skipIf(!HAS_DB)("Failed jobs needing review, grouped (integration)", () => {
  // biome-ignore lint/style/noNonNullAssertion: gated by HAS_DB
  const db = createDb(process.env.DATABASE_URL!);
  const jobs = new DrizzleFailedJobReviewRepository(db);
  const integrations = new DrizzleIntegrationDeadLetterRepository(db);
  const tag = randomUUID().slice(0, 8);
  const now = Date.now();
  const since = new Date(now - 24 * HOUR);
  const created = { jobIds: [] as string[], eventIds: [] as number[], webhookIds: [] as string[] };

  const mine = (groups: FailedJobNeedsReviewGroup[]) =>
    groups
      .filter((group) => group.jobType.includes(tag))
      .sort((a, b) => a.jobType.localeCompare(b.jobType) || a.errorLine.localeCompare(b.errorLine));

  async function failedJob(input: {
    queue: string;
    error: string | null;
    hoursAgo: number;
    state?: "needs_review" | "retried" | "discarded";
  }) {
    const id = `${tag}-${created.jobIds.length}`;
    created.jobIds.push(id);
    const at = new Date(now - input.hoursAgo * HOUR);
    await db.insert(failedJobs).values({
      id,
      originalQueue: input.queue,
      originalJobName: "send",
      payloadJson: JSON.stringify({ email: "lena@north.com" }),
      errorMessage: input.error,
      attempts: 5,
      firstFailedAt: at,
      failedAt: at,
      ...(input.state === "retried" ? { replayedAt: new Date(), replayedBy: "staff" } : {}),
      ...(input.state === "discarded"
        ? { discardedAt: new Date(), discardedBy: "staff", discardReason: "other" }
        : {}),
    });
  }

  afterAll(async () => {
    if (created.jobIds.length) {
      await db.delete(failedJobs).where(inArray(failedJobs.id, created.jobIds));
    }
    if (created.webhookIds.length) {
      await db.delete(webhookEvent).where(inArray(webhookEvent.id, created.webhookIds));
    }
    if (created.eventIds.length) {
      await db.delete(domainEvent).where(inArray(domainEvent.id, created.eventIds));
    }
  });

  it("counts background jobs needing review by queue, job name and first error line", async () => {
    const queue = `send-email-${tag}`;
    await failedJob({ queue, error: "Postmark 422\n  at send (x.js:1)", hoursAgo: 30 });
    await failedJob({ queue, error: "  Postmark 422  \r\n  at other", hoursAgo: 2 });
    await failedJob({ queue, error: "Postmark 422", hoursAgo: 1 });
    await failedJob({ queue, error: null, hoursAgo: 1 });
    await failedJob({ queue, error: "Postmark 422", hoursAgo: 1, state: "retried" });
    await failedJob({ queue, error: "Postmark 422", hoursAgo: 1, state: "discarded" });

    const groups = mine(await jobs.needsReviewGroups(since));
    expect(groups).toEqual([
      expect.objectContaining({ jobType: queue, jobName: "send", errorLine: "", count: 1 }),
      expect.objectContaining({
        jobType: queue,
        jobName: "send",
        errorLine: "Postmark 422",
        count: 3,
        newSince: 2,
        firstFailedAt: new Date(now - 30 * HOUR),
        lastFailedAt: new Date(now - 1 * HOUR),
      }),
    ]);
    expect(groups[1]?.firstFailedAt).toBeInstanceOf(Date);
  });

  it("counts dead-lettered deliveries by consumer and event type, leaving out decided ones", async () => {
    const consumer = `zoho-${tag}`;
    const deliveryIds: number[] = [];
    for (const [index, hoursAgo] of [3, 2, 1].entries()) {
      const [event] = await db
        .insert(domainEvent)
        .values({
          eventType: "user.registered",
          aggregateType: "user",
          aggregateId: `user-${tag}-${index}`,
          schemaVersion: 1,
          payload: { email: "lena@north.com" },
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
          status: "dead_lettered",
          attempts: 6,
          lastError: "ZOHO_INVALID_DATA: mandatory field missing\nstack",
          createdAt: new Date(now - hoursAgo * HOUR),
          updatedAt: new Date(now - hoursAgo * HOUR),
        })
        .returning({ id: domainEventDelivery.id });
      if (!delivery) throw new Error("delivery not created");
      deliveryIds.push(delivery.id);
    }
    // One of them was set aside by staff: it no longer needs review.
    const discardedId = `delivery:${deliveryIds[0]}`;
    created.jobIds.push(discardedId);
    await db.insert(failedJobs).values({
      id: discardedId,
      originalQueue: "integrations",
      attempts: 6,
      firstFailedAt: new Date(now - 3 * HOUR),
      failedAt: new Date(now - 3 * HOUR),
      discardedAt: new Date(),
      discardedBy: "staff",
      discardReason: "other",
    });

    const groups = mine(await integrations.needsReviewGroups(since));
    expect(groups).toEqual([
      {
        jobType: `delivery:${consumer}`,
        jobName: "user.registered",
        errorLine: "ZOHO_INVALID_DATA: mandatory field missing",
        count: 2,
        newSince: 2,
        firstFailedAt: new Date(now - 2 * HOUR),
        lastFailedAt: new Date(now - 1 * HOUR),
      },
    ]);
  });

  it("counts failed webhooks by sender", async () => {
    const source = `stripe-${tag}`;
    const [row] = await db
      .insert(webhookEvent)
      .values({
        source,
        eventKey: `evt-${tag}`,
        payload: { type: "charge.refunded" },
        attempts: 3,
        lastError: "handler threw",
        receivedAt: new Date(now - 48 * HOUR),
      })
      .returning({ id: webhookEvent.id });
    if (!row) throw new Error("webhook not created");
    created.webhookIds.push(row.id);

    const groups = mine(await integrations.needsReviewGroups(since));
    expect(groups).toContainEqual(
      expect.objectContaining({
        jobType: `webhook:${source}`,
        jobName: "charge.refunded",
        errorLine: "handler threw",
        count: 1,
        newSince: 0,
      }),
    );
  });
});
