import { createInventoryPeerClient } from "@auction/artwork-register-contracts";
import type { Logger } from "pino";
import type { WorkerEnv } from "../env.js";
import { createZohoCrmGatewayWithCoql } from "../integrations/zoho/create-zoho-crm-gateway.js";
import { CrmZohoOrderRecords } from "../integrations/zoho/fulfilment/zoho-order-modules.js";
import { createShopApiQcReady } from "../integrations/zoho/qc/shop-api-qc-ready.js";
import { ZohoQcReady } from "../integrations/zoho/qc/zoho-qc-ready.js";

/**
 * Builds the Zoho quality check to LAX print step. With the mode off nothing is built, so neither
 * Zoho nor LAX Shop is called. The environment schema makes every setting required otherwise.
 */
export function createZohoQcReady(deps: { env: WorkerEnv; log: Logger }): ZohoQcReady | undefined {
  const { env, log } = deps;
  const mode = env.ZOHO_QC_READY_MODE;
  if (mode === "off") return undefined;
  const { SHOP_API_INVENTORY_BASE_URL: baseUrl } = env;
  const clientId = env.INVENTORY_MACHINE_CLIENT_ID;
  const clientSecret = env.INVENTORY_MACHINE_CLIENT_SECRET;
  if (!baseUrl || !clientId || !clientSecret) throw new Error("zoho_qc_ready_not_configured");
  return new ZohoQcReady({
    mode,
    zoho: new CrmZohoOrderRecords(createZohoCrmGatewayWithCoql(env)),
    shop: createShopApiQcReady(createInventoryPeerClient({ baseUrl, clientId, clientSecret })),
    orderRefField: env.ZOHO_FULFILMENT_ORDER_REF_FIELD,
    log,
  });
}
