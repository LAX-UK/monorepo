import type { RuntimeOwnershipConfig } from "@auction/background-runtime";
import type { WorkerEnv } from "../env.js";

export function runtimeOwnershipConfigFromWorkerEnv(env: WorkerEnv): RuntimeOwnershipConfig {
  return {
    financeCronExecutionOwner: env.FINANCE_CRON_EXECUTION_OWNER,
    lifecycleExecutionOwner: env.LIFECYCLE_EXECUTION_OWNER,
    absenteeReplayOwner: env.ABSENTEE_REPLAY_OWNER,
    xeroProjectorMode: env.XERO_PROJECTOR_MODE,
    financeCronApiRollbackEnabled: env.FINANCE_CRON_API_ROLLBACK,
  };
}
