import type { ZohoCampaignsSuppressionSyncService } from "../services/zoho-campaigns-suppression-sync.service.js";

/** Runs on the inbound webhook queue, so a failed pass lands on Failed jobs with the rest. */
export const ZOHO_CAMPAIGNS_SUPPRESSION_JOB_NAME = "zoho-campaigns-suppression-sync" as const;

/** Every hour at quarter past, so an unsubscribe is honoured within the hour. */
export const ZOHO_CAMPAIGNS_SUPPRESSION_PATTERN = "15 * * * *";
export const ZOHO_CAMPAIGNS_SUPPRESSION_TIME_ZONE = "Europe/London";

export function createZohoCampaignsSuppressionJob(
  service: ZohoCampaignsSuppressionSyncService,
): () => Promise<void> {
  return async () => {
    await service.run();
  };
}
