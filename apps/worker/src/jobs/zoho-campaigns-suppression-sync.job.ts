import type { ZohoCampaignsSuppressionSyncService } from "../services/zoho-campaigns-suppression-sync.service.js";

/** Runs on the inbound webhook queue, so a failed pass lands on Failed jobs with the rest. */
export const ZOHO_CAMPAIGNS_SUPPRESSION_JOB_NAME = "zoho-campaigns-suppression-sync" as const;

/**
 * Daily at 03:15. Each pass reads both whole lists (Campaigns has no "changed since" filter), so
 * it runs once a day to keep to Zoho's API allowance. If an hourly pass is ever needed, give it a
 * page budget first and record the need in docs/integrations/zoho.md.
 */
export const ZOHO_CAMPAIGNS_SUPPRESSION_PATTERN = "15 3 * * *";
export const ZOHO_CAMPAIGNS_SUPPRESSION_TIME_ZONE = "Europe/London";

export function createZohoCampaignsSuppressionJob(
  service: ZohoCampaignsSuppressionSyncService,
): () => Promise<void> {
  return async () => {
    await service.run();
  };
}
