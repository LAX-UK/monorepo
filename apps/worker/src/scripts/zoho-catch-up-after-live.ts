#!/usr/bin/env tsx
/**
 * Sends what a Zoho write-back skipped during its dry run, once it is live. See "Switching a
 * write-back to live" in docs/integrations/zoho.md. `--dry-run` only counts.
 */
import { closeDb, createDb } from "@auction/db";
import { DrizzleDomainEventDeliveryRepository } from "@auction/persistence/repositories";
import { catchUpAfterGoingLive } from "../integrations/zoho/zoho-go-live-catch-up.js";
import { parseZohoCatchUpArgs, zohoCatchUpMode } from "./zoho-catch-up-after-live.args.js";

async function main(): Promise<void> {
  const args = parseZohoCatchUpArgs(process.argv.slice(2));
  const mode = zohoCatchUpMode(args.consumer, process.env);
  const url = process.env.DATABASE_URL_WORKER ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_WORKER or DATABASE_URL is required");
  const db = createDb(url);
  try {
    const summary = await catchUpAfterGoingLive({
      ...args,
      mode,
      repo: new DrizzleDomainEventDeliveryRepository(db),
    });
    console.log(JSON.stringify(summary));
  } finally {
    await closeDb(db);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
