import type { WorkerEnv } from "../env.js";
import { assertZohoCrmOrgEnvironment } from "../integrations/zoho/zoho-crm-org-check.js";

/** Guard used by backfill before any Zoho HTTP writes (canary/live only). */
export async function runBackfillCrmUsersOrgGuard(input: {
  performHttp: boolean;
  env: WorkerEnv;
}): Promise<void> {
  if (!input.performHttp) return;
  await assertZohoCrmOrgEnvironment(input.env);
}
