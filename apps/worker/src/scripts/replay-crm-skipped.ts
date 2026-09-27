#!/usr/bin/env tsx
/** Re-queue skipped Zoho CRM deliveries for selected event types. */
import { createDb } from "@auction/db";
import { DrizzleDomainEventDeliveryRepository } from "@auction/persistence/repositories";
import { listDomainEventTypesForConsumer } from "@auction/types";
import { loadWorkerEnv } from "../env.js";

const PAGE_SIZE = 500;

async function main(): Promise<void> {
  const env = loadWorkerEnv();
  const db = createDb(env.DATABASE_URL_WORKER ?? env.DATABASE_URL);
  const repo = new DrizzleDomainEventDeliveryRepository(db);
  const enabled = env.ZOHO_CRM_ENABLED_EVENT_TYPES.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const eventTypes = enabled.length > 0 ? enabled : listDomainEventTypesForConsumer("zoho");

  let totalReplayed = 0;
  for (;;) {
    const replayed = await repo.replaySkippedForEventTypes({
      consumer: "zoho",
      eventTypes,
      limit: PAGE_SIZE,
    });
    totalReplayed += replayed;
    if (replayed < PAGE_SIZE) break;
  }
  console.log(JSON.stringify({ replayed: totalReplayed, eventTypes }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
