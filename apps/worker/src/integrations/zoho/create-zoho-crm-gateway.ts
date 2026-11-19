import type { WorkerEnv } from "../../env.js";
import type { CrmBatchUpdate, CrmCoqlQuery, CrmGateway } from "../crm/crm-gateway.js";
import { parseZohoCrmTrigger } from "./zoho-crm-config.js";
import { ZohoCrmGatewayCrmErrorAdapter } from "./zoho-crm-gateway-crm-error-adapter.js";
import { ZohoCrmGatewayLimiter } from "./zoho-crm-gateway-limiter.js";
import { ZohoCrmGateway } from "./zoho-crm-gateway.js";

/**
 * One limiter per worker process (the worker parses its env once), shared by every Zoho CRM stack:
 * CRM sync, write-back, Status, listing, location, fulfilment, QC and the scripts. All of them
 * spend one org's API credits, so they share one call spacing and one circuit breaker.
 */
const processLimiters = new WeakMap<WorkerEnv, ZohoCrmGatewayLimiter>();

export function zohoCrmGatewayLimiter(env: WorkerEnv): ZohoCrmGatewayLimiter {
  let limiter = processLimiters.get(env);
  if (!limiter) {
    const inner = new ZohoCrmGateway(env, {
      apiHost: env.ZOHO_CRM_API_HOST,
      trigger: parseZohoCrmTrigger(env.ZOHO_CRM_UPSERT_TRIGGER),
    });
    limiter = new ZohoCrmGatewayLimiter(inner);
    processLimiters.set(env, limiter);
  }
  return limiter;
}

/** The Zoho gateway behind the process's shared limiter and error mapping. */
function createZohoCrmStack(env: WorkerEnv): ZohoCrmGatewayCrmErrorAdapter {
  return new ZohoCrmGatewayCrmErrorAdapter(zohoCrmGatewayLimiter(env));
}

export function createZohoCrmGateway(env: WorkerEnv): CrmGateway {
  return createZohoCrmStack(env);
}

/** COQL reads and writes, for the write-back, Status, fulfilment and QC. */
export function createZohoCrmGatewayWithCoql(env: WorkerEnv): CrmGateway & CrmCoqlQuery {
  return createZohoCrmStack(env);
}

/** COQL reads and batched updates, for the LAX listing and location on Zoho Products. */
export function createZohoCrmBatchStack(env: WorkerEnv): CrmCoqlQuery & CrmBatchUpdate {
  return createZohoCrmStack(env);
}

/** Read-only COQL access through the same limiter and token handling as the write gateway. */
export function createZohoCoqlQuery(env: WorkerEnv): CrmCoqlQuery {
  return createZohoCrmStack(env);
}
