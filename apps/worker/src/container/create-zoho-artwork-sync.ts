import type { createDb } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleZohoArtworkSyncStore,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { ZohoArtworkSyncService } from "../integrations/zoho/artwork/zoho-artwork-sync-service.js";
import { CoqlZohoCatalogueReader } from "../integrations/zoho/artwork/zoho-catalogue-reader.js";
import { createZohoCoqlQuery } from "../integrations/zoho/create-zoho-crm-gateway.js";
import {
  type ZohoArtworkSyncJobs,
  createZohoArtworkSyncJobs,
} from "../jobs/zoho-artwork-sync.job.js";
import { DrizzleLinkedListingProjector } from "../repositories/drizzle-linked-listing-projector.js";

export type ZohoArtworkSyncRuntime = {
  jobs: ZohoArtworkSyncJobs;
  /** True when the nightly check should be scheduled (the mode is not off). */
  scheduleNightly: boolean;
};

/**
 * Builds the Zoho artwork sync. With the mode off the service still exists so a stored notice is
 * consumed and ignored, but nothing is scheduled and Zoho is never called.
 */
export function createZohoArtworkSyncRuntime(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): ZohoArtworkSyncRuntime {
  const { env, db, log } = deps;
  const store = new DrizzleZohoArtworkSyncStore(db);
  const service = new ZohoArtworkSyncService({
    mode: env.ZOHO_ARTWORK_SYNC_MODE,
    reader: new CoqlZohoCatalogueReader(createZohoCoqlQuery(env)),
    register: new DrizzleArtworkRegisterRepository(db),
    report: store,
    watermark: store,
    listings: new DrizzleLinkedListingProjector(db),
    log,
  });
  return {
    jobs: createZohoArtworkSyncJobs(service),
    scheduleNightly: env.ZOHO_ARTWORK_SYNC_MODE !== "off",
  };
}
