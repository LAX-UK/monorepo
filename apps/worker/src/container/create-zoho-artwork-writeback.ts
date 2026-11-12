import type { createDb } from "@auction/db";
import {
  DrizzleArtworkRegisterRepository,
  DrizzleZohoListingSourceReader,
} from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { ZohoArtworkWritebackService } from "../integrations/zoho/artwork/zoho-artwork-writeback-service.js";
import { CrmZohoProductWriter } from "../integrations/zoho/artwork/zoho-product-writer.js";
import { createZohoCrmGatewayWithCoql } from "../integrations/zoho/create-zoho-crm-gateway.js";
import { createZohoStatusSync } from "./create-zoho-status-sync.js";

/**
 * Builds the writeback of artwork state to Zoho Products. With the mode off nothing is built, so
 * Zoho is never reached; in dry run the service only logs what it would send.
 */
export function createZohoArtworkWriteback(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): ZohoArtworkWritebackService | undefined {
  const { env, db, log } = deps;
  const mode = env.ZOHO_ARTWORK_WRITEBACK_MODE;
  const status = createZohoStatusSync({ env, db, log });
  if (mode === "off" || !status) return undefined;

  const stack = createZohoCrmGatewayWithCoql(env);
  return new ZohoArtworkWritebackService({
    mode,
    products: new CrmZohoProductWriter(stack, stack),
    register: new DrizzleArtworkRegisterRepository(db),
    status,
    sources: new DrizzleZohoListingSourceReader(db),
    log,
  });
}
