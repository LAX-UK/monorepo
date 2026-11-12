import type { createDb } from "@auction/db";
import { DrizzleZohoListingSourceReader } from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { ZohoStatusReconcile } from "../integrations/zoho/artwork/status/zoho-status-reconcile.js";
import { createZohoStatusSync } from "./create-zoho-status-sync.js";

/**
 * The nightly Zoho Status check, scheduled by the Status writeback mode alone. Withdrawn goes back
 * to Available after 30 days with no register event, and missed drift is repaired, so neither can
 * depend on the listing being on. When the listing is on its own nightly pass already runs the
 * Status check, so nothing is built here and the artworks are not checked twice.
 */
export function createZohoStatusNightly(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
  listingOn: boolean;
}): ZohoStatusReconcile | undefined {
  if (deps.listingOn) return undefined;
  const sync = createZohoStatusSync(deps);
  if (!sync) return undefined;
  return new ZohoStatusReconcile({
    sync,
    sources: new DrizzleZohoListingSourceReader(deps.db),
    log: deps.log,
  });
}
