import type { createDb } from "@auction/db";
import {
  DrizzleZohoListingLock,
  DrizzleZohoListingSourceReader,
  DrizzleZohoLocationSourceReader,
  zohoListingLockPool,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { CrmZohoLocationProducts } from "../integrations/zoho/artwork/location/zoho-location-products.js";
import { ZohoLocationReconcile } from "../integrations/zoho/artwork/location/zoho-location-reconcile.js";
import { ZohoLocationSync } from "../integrations/zoho/artwork/location/zoho-location-sync.js";
import { ZohoLocationWriteback } from "../integrations/zoho/artwork/location/zoho-location-writeback.js";
import { createZohoCrmBatchStack } from "../integrations/zoho/create-zoho-crm-gateway.js";

export type ZohoArtworkLocationRuntime = {
  writeback: ZohoLocationWriteback;
  /** The nightly drift check. */
  reconcile: ZohoLocationReconcile;
};

/**
 * Builds the stock location mirror on Zoho Products (`LAX_Location`). With the mode off nothing is
 * built, so Zoho is never called. The environment schema makes the Zoho settings required
 * otherwise, and `live` turns on the wrong-org guard at start-up.
 */
export function createZohoArtworkLocation(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): ZohoArtworkLocationRuntime | undefined {
  const { env, db, log } = deps;
  const mode = env.ZOHO_ARTWORK_LOCATION_MODE;
  if (mode === "off") return undefined;
  const sync = new ZohoLocationSync({
    mode,
    sources: new DrizzleZohoLocationSourceReader(db),
    products: new CrmZohoLocationProducts(createZohoCrmBatchStack(env)),
    // The listing's per-artwork lock: a later writer always reads newer facts.
    lock: new DrizzleZohoListingLock(zohoListingLockPool(db)),
    log,
  });
  return {
    writeback: new ZohoLocationWriteback({ sync, mode }),
    reconcile: new ZohoLocationReconcile({
      mode,
      sync,
      sources: new DrizzleZohoListingSourceReader(db),
      log,
    }),
  };
}
