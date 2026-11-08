import type { createDb } from "@auction/db";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { HttpZohoCampaignsContactSource } from "../integrations/zoho/campaigns/zoho-campaigns-contact-source.js";
import { createZohoCampaignsSuppressionJob } from "../jobs/zoho-campaigns-suppression-sync.job.js";
import { DrizzleZohoCampaignsSuppressionRepository } from "../repositories/drizzle-zoho-campaigns-suppression.repository.js";
import { ZohoCampaignsSuppressionSyncService } from "../services/zoho-campaigns-suppression-sync.service.js";

/** The hourly pass, or null when the mode is off: nothing is built, scheduled or sent to Zoho. */
export function createZohoCampaignsSuppressionRuntime(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): (() => Promise<void>) | null {
  const { env, db, log } = deps;
  if (env.ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE === "off") return null;
  return createZohoCampaignsSuppressionJob(
    new ZohoCampaignsSuppressionSyncService({
      mode: env.ZOHO_CAMPAIGNS_SUPPRESSION_SYNC_MODE,
      source: new HttpZohoCampaignsContactSource(env),
      repo: new DrizzleZohoCampaignsSuppressionRepository(db),
      log,
    }),
  );
}
