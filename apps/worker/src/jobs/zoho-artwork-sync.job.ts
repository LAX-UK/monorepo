import type { ZohoArtworkSyncService } from "../integrations/zoho/artwork/zoho-artwork-sync-service.js";

/** Runs on the inbound webhook queue, so a failed run lands on Failed jobs with the rest. */
export const ZOHO_ARTWORK_NIGHTLY_JOB_NAME = "zoho-artwork-nightly-check" as const;

/** 02:30 London time, after the evening's catalogue edits and before the working day. */
export const ZOHO_ARTWORK_NIGHTLY_PATTERN = "30 2 * * *";
export const ZOHO_ARTWORK_NIGHTLY_TIME_ZONE = "Europe/London";

/** The part of the sync the webhook worker and its scheduler call. */
export type ZohoArtworkSyncJobs = {
  processNotice: (input: { productId: string; eventKey: string }) => Promise<void>;
  runNightlyCheck: () => Promise<void>;
};

export function createZohoArtworkSyncJobs(service: ZohoArtworkSyncService): ZohoArtworkSyncJobs {
  return {
    processNotice: async ({ productId, eventKey }) => {
      await service.processNotice({ productId, runId: `notice:${eventKey}` });
    },
    runNightlyCheck: async () => {
      await service.runNightly();
    },
  };
}
