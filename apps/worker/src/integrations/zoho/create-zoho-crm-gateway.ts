import type { WorkerEnv } from "../../env.js";
import type { CrmCoqlQuery, CrmGateway } from "../crm/crm-gateway.js";
import { parseZohoCrmTrigger } from "./zoho-crm-config.js";
import { ZohoCrmGatewayCrmErrorAdapter } from "./zoho-crm-gateway-crm-error-adapter.js";
import { ZohoCrmGatewayLimiter } from "./zoho-crm-gateway-limiter.js";
import { ZohoCrmGateway } from "./zoho-crm-gateway.js";

/** The Zoho gateway behind its limiter and error mapping; one stack serves writes and COQL reads. */
function createZohoCrmStack(env: WorkerEnv): ZohoCrmGatewayCrmErrorAdapter {
  const inner = new ZohoCrmGateway(env, {
    apiHost: env.ZOHO_CRM_API_HOST,
    trigger: parseZohoCrmTrigger(env.ZOHO_CRM_UPSERT_TRIGGER),
  });
  const limited = new ZohoCrmGatewayLimiter(inner);
  return new ZohoCrmGatewayCrmErrorAdapter(limited);
}

export function createZohoCrmGateway(env: WorkerEnv): CrmGateway {
  return createZohoCrmStack(env);
}

/** One stack for the writeback's read (COQL) and write (update), so both share one rate limiter. */
export function createZohoCrmGatewayWithCoql(env: WorkerEnv): CrmGateway & CrmCoqlQuery {
  return createZohoCrmStack(env);
}

/** Read-only COQL access through the same limiter and token handling as the write gateway. */
export function createZohoCoqlQuery(env: WorkerEnv): CrmCoqlQuery {
  return createZohoCrmStack(env);
}
