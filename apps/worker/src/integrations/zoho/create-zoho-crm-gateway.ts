import type { WorkerEnv } from "../../env.js";
import type { CrmGateway } from "../crm/crm-gateway.js";
import { parseZohoCrmTrigger } from "./zoho-crm-config.js";
import { ZohoCrmGatewayCrmErrorAdapter } from "./zoho-crm-gateway-crm-error-adapter.js";
import { ZohoCrmGatewayLimiter } from "./zoho-crm-gateway-limiter.js";
import { ZohoCrmGateway } from "./zoho-crm-gateway.js";

export function createZohoCrmGateway(env: WorkerEnv): CrmGateway {
  const inner = new ZohoCrmGateway(env, {
    apiHost: env.ZOHO_CRM_API_HOST,
    trigger: parseZohoCrmTrigger(env.ZOHO_CRM_UPSERT_TRIGGER),
  });
  const limited = new ZohoCrmGatewayLimiter(inner);
  return new ZohoCrmGatewayCrmErrorAdapter(limited);
}
