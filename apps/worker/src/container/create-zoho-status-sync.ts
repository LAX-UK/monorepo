import type { createDb } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleZohoListingLock,
  DrizzleZohoListingSourceReader,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { CrmZohoStatusProducts } from "../integrations/zoho/artwork/status/zoho-status-products.js";
import { ZohoStatusSync } from "../integrations/zoho/artwork/status/zoho-status-sync.js";
import { createZohoCrmGatewayWithCoql } from "../integrations/zoho/create-zoho-crm-gateway.js";

/**
 * Builds the compare-and-set of the Zoho Status, in the writeback's mode. With the writeback off
 * nothing is built, so Zoho is never reached for the Status by any path.
 */
export function createZohoStatusSync(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): ZohoStatusSync | undefined {
  const { env, db, log } = deps;
  const mode = env.ZOHO_ARTWORK_WRITEBACK_MODE;
  if (mode === "off") return undefined;

  const stack = createZohoCrmGatewayWithCoql(env);
  return new ZohoStatusSync({
    mode,
    sources: new DrizzleZohoListingSourceReader(db),
    register: new DrizzleArtworkRegisterRepository(db),
    products: new CrmZohoStatusProducts(stack, stack),
    lock: new DrizzleZohoListingLock(db),
    log,
  });
}
