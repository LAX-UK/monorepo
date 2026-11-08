import type { createDb } from "@auction/db";
import { DrizzleArtworkRegisterRepository } from "@auction/persistence/repositories";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { createZohoCrmGatewayWithCoql } from "../integrations/zoho/create-zoho-crm-gateway.js";
import { createDrizzlePrintGroupFactsReader } from "../integrations/zoho/fulfilment/drizzle-print-group-facts.reader.js";
import { PrintGroupMirror } from "../integrations/zoho/fulfilment/print-group-mirror.js";
import { ZohoFulfilmentMirror } from "../integrations/zoho/fulfilment/zoho-fulfilment-mirror.js";
import { CrmZohoPrintModules } from "../integrations/zoho/fulfilment/zoho-print-modules.js";

/**
 * Builds the fulfilment mirror to Zoho. With the mode off nothing is built, so neither Zoho nor
 * Shop's tables are ever touched. The environment schema makes the Zoho credentials required
 * otherwise, and `live` must pass the org check.
 */
export function createZohoFulfilmentMirror(deps: {
  env: WorkerEnv;
  db: ReturnType<typeof createDb>;
  log: Logger;
}): ZohoFulfilmentMirror | undefined {
  const { env, db, log } = deps;
  const mode = env.ZOHO_FULFILMENT_MIRROR_MODE;
  if (mode === "off") return undefined;
  return new ZohoFulfilmentMirror({
    groups: new PrintGroupMirror({
      facts: createDrizzlePrintGroupFactsReader(db),
      register: new DrizzleArtworkRegisterRepository(db),
      zoho: new CrmZohoPrintModules(createZohoCrmGatewayWithCoql(env)),
      mode,
      now: () => new Date(),
      log,
    }),
  });
}
