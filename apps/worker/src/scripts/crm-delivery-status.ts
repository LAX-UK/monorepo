#!/usr/bin/env tsx
/** Read-only Zoho CRM domain_event_delivery status for test operators. */
import { createDb } from "@auction/db";
import { domainEvent, domainEventDelivery } from "@auction/db/schema";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { loadWorkerEnv } from "../env.js";
import {
  type CrmDeliveryStatusSnapshot,
  type DeliveryProblemRow,
  type DeliveryStatusCountRow,
  buildCrmDeliveryStatusReport,
} from "./crm-delivery-status-report.js";

const CONSUMER = "zoho";
const PROBLEM_LIMIT = 20;

function toIso(date: Date | null | undefined): string {
  return date?.toISOString() ?? "";
}

async function loadSnapshot(db: ReturnType<typeof createDb>): Promise<CrmDeliveryStatusSnapshot> {
  const countRows = await db
    .select({
      eventType: domainEvent.eventType,
      status: domainEventDelivery.status,
      count: sql<number>`count(*)::int`,
    })
    .from(domainEventDelivery)
    .innerJoin(domainEvent, eq(domainEvent.id, domainEventDelivery.eventId))
    .where(eq(domainEventDelivery.consumer, CONSUMER))
    .groupBy(domainEvent.eventType, domainEventDelivery.status)
    .orderBy(domainEvent.eventType, domainEventDelivery.status);

  const countsByEventTypeAndStatus: DeliveryStatusCountRow[] = countRows.map((row) => ({
    eventType: row.eventType,
    status: row.status,
    count: row.count,
  }));

  const oldestPending = await db
    .select({ createdAt: domainEventDelivery.createdAt })
    .from(domainEventDelivery)
    .where(
      and(eq(domainEventDelivery.consumer, CONSUMER), eq(domainEventDelivery.status, "pending")),
    )
    .orderBy(asc(domainEventDelivery.createdAt))
    .limit(1);

  const oldestPendingAgeSeconds =
    oldestPending[0]?.createdAt != null
      ? Math.max(0, Math.floor((Date.now() - oldestPending[0].createdAt.getTime()) / 1000))
      : null;

  const problemStatuses = ["retryable", "dead_lettered"] as const;

  const problemRows = await db
    .select({
      eventId: domainEventDelivery.eventId,
      eventType: domainEvent.eventType,
      attempts: domainEventDelivery.attempts,
      updatedAt: domainEventDelivery.updatedAt,
      lastError: domainEventDelivery.lastError,
      status: domainEventDelivery.status,
    })
    .from(domainEventDelivery)
    .innerJoin(domainEvent, eq(domainEvent.id, domainEventDelivery.eventId))
    .where(
      and(
        eq(domainEventDelivery.consumer, CONSUMER),
        inArray(domainEventDelivery.status, [...problemStatuses]),
      ),
    )
    .orderBy(desc(domainEventDelivery.updatedAt))
    .limit(PROBLEM_LIMIT * 2);

  const mapProblem = (row: (typeof problemRows)[number]): DeliveryProblemRow => ({
    eventId: row.eventId,
    eventType: row.eventType,
    attempts: row.attempts,
    updatedAt: toIso(row.updatedAt),
    lastError: row.lastError,
  });

  const retryableRecent = problemRows
    .filter((row) => row.status === "retryable")
    .slice(0, PROBLEM_LIMIT)
    .map(mapProblem);

  const deadLetteredRecent = problemRows
    .filter((row) => row.status === "dead_lettered")
    .slice(0, PROBLEM_LIMIT)
    .map(mapProblem);

  return {
    consumer: CONSUMER,
    countsByEventTypeAndStatus,
    oldestPendingAgeSeconds,
    retryableRecent,
    deadLetteredRecent,
  };
}

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const snapshot = await loadSnapshot(db);
  console.log(buildCrmDeliveryStatusReport(snapshot));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
