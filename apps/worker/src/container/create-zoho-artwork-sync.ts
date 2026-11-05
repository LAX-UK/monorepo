import type { createDb } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleZohoArtworkSyncStore,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { CrmProductImageGateway } from "../integrations/zoho/artwork/images/crm-product-image-gateway.js";
import { createSharpImageNormalizer } from "../integrations/zoho/artwork/images/image-normalizer.js";
import { createUploadStorageImageStore } from "../integrations/zoho/artwork/images/upload-storage-image-store.js";
import { ZohoImageSyncService } from "../integrations/zoho/artwork/images/zoho-image-sync.service.js";
import {
  ZohoArtworkSyncService,
  type ZohoProductImages,
} from "../integrations/zoho/artwork/zoho-artwork-sync-service.js";
import { CoqlZohoCatalogueReader } from "../integrations/zoho/artwork/zoho-catalogue-reader.js";
import { createZohoCoqlQuery } from "../integrations/zoho/create-zoho-crm-gateway.js";
import {
  type ZohoArtworkSyncJobs,
  createZohoArtworkSyncJobs,
} from "../jobs/zoho-artwork-sync.job.js";
import { createUploadStorage } from "../lib/upload-storage.js";

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
  const register = new DrizzleArtworkRegisterRepository(db);
  const service = new ZohoArtworkSyncService({
    mode: env.ZOHO_ARTWORK_SYNC_MODE,
    reader: new CoqlZohoCatalogueReader(createZohoCoqlQuery(env)),
    images: createPictureSync(env, register, log),
    imageCheck: register,
    register,
    report: store,
    watermark: store,
    log,
  });
  return {
    jobs: createZohoArtworkSyncJobs(service),
    scheduleNightly: env.ZOHO_ARTWORK_SYNC_MODE !== "off",
  };
}

/** Builds the picture sync only when the sync can run, so a worker with it off never needs storage. */
function createPictureSync(
  env: WorkerEnv,
  store: DrizzleArtworkRegisterRepository,
  log: Logger,
): ZohoProductImages {
  if (env.ZOHO_ARTWORK_SYNC_MODE === "off") {
    return { syncProduct: async () => ({ status: "unavailable", ...NO_PICTURES }) };
  }
  return new ZohoImageSyncService({
    gateway: new CrmProductImageGateway(env, { apiHost: env.ZOHO_CRM_API_HOST }),
    store,
    objects: createUploadStorageImageStore(createUploadStorage(env)),
    normalizer: createSharpImageNormalizer(),
    log,
  });
}

const NO_PICTURES = {
  remote: 0,
  reused: 0,
  downloaded: 0,
  rejected: 0,
  failed: 0,
  removed: 0,
  ignored: 0,
  changed: false,
} as const;
