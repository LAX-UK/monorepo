import type { RuntimeOwnershipConfig } from "@auction/background-runtime";

export type ApiRuntimeEnvSlice = {
  LIFECYCLE_EXECUTION_OWNER: "api" | "worker";
  ABSENTEE_REPLAY_OWNER?: "api_rollback" | "worker";
  FINANCE_CRON_EXECUTION_OWNER?: "api_rollback" | "worker";
  FINANCE_CRON_API_ROLLBACK?: boolean;
  XERO_PROJECTOR_MODE?: "off" | "shadow" | "canary" | "live" | undefined;
};

export function runtimeOwnershipConfigFromApiEnv(env: ApiRuntimeEnvSlice): RuntimeOwnershipConfig {
  return {
    financeCronExecutionOwner: env.FINANCE_CRON_EXECUTION_OWNER ?? "api_rollback",
    lifecycleExecutionOwner: env.LIFECYCLE_EXECUTION_OWNER,
    absenteeReplayOwner: env.ABSENTEE_REPLAY_OWNER ?? "api_rollback",
    xeroProjectorMode: env.XERO_PROJECTOR_MODE ?? "off",
    financeCronApiRollbackEnabled: env.FINANCE_CRON_API_ROLLBACK ?? true,
  };
}
