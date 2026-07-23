import { BACKGROUND_OPERATION_REGISTRY } from "./registry.js";
import type { RuntimeOwnershipConfig } from "./types.js";

export type RuntimeOwnershipValidationResult = { ok: true } | { ok: false; errors: string[] };

/**
 * Ensures deployment config does not run duplicate owners for lifecycle or
 * finance cron (worker direct + API HTTP proxy simultaneously).
 */
export function validateRuntimeOwnership(
  config: RuntimeOwnershipConfig,
  context: "api" | "worker",
): RuntimeOwnershipValidationResult {
  const errors: string[] = [];

  if (config.lifecycleExecutionOwner !== "api" && config.lifecycleExecutionOwner !== "worker") {
    errors.push("invalid lifecycleExecutionOwner");
  }

  if (
    context === "api" &&
    config.lifecycleExecutionOwner === "worker" &&
    process.env.API_STARTS_LOT_LIFECYCLE_WORKER === "true"
  ) {
    errors.push(
      "API must not start lot-lifecycle BullMQ consumer when LIFECYCLE_EXECUTION_OWNER=worker",
    );
  }

  if (
    context === "worker" &&
    config.financeCronExecutionOwner === "worker" &&
    config.financeCronApiRollbackEnabled
  ) {
    errors.push(
      "FINANCE_CRON_API_ROLLBACK cannot be true when FINANCE_CRON_EXECUTION_OWNER=worker",
    );
  }

  if (
    context === "worker" &&
    config.financeCronExecutionOwner === "worker" &&
    !config.financeCronApiRollbackEnabled &&
    config.workerFinanceCronHandlersReady === false
  ) {
    errors.push(
      "worker finance cron handlers required when FINANCE_CRON_EXECUTION_OWNER=worker (set CRON_INTERNAL_SECRET and finance services)",
    );
  }

  if (config.lifecycleExecutionOwner === "api" && config.absenteeReplayOwner === "worker") {
    errors.push("ABSENTEE_REPLAY_OWNER=worker requires LIFECYCLE_EXECUTION_OWNER=worker");
  }

  if (
    context === "worker" &&
    config.lifecycleExecutionOwner === "worker" &&
    config.workerLifecycleHandlersReady === false
  ) {
    errors.push(
      "worker lifecycle handlers required when LIFECYCLE_EXECUTION_OWNER=worker (redis, executor, tick, queue consumer)",
    );
  }

  if (
    context === "worker" &&
    config.absenteeReplayOwner === "worker" &&
    config.workerAbsenteeReplayReady === false
  ) {
    errors.push(
      "worker absentee replay required when ABSENTEE_REPLAY_OWNER=worker (local bidding composition)",
    );
  }

  if (
    context === "worker" &&
    config.absenteeReplayOwner === "worker" &&
    config.workerBidKycEnforcementReady === false
  ) {
    errors.push(
      "worker KYC bid enforcement required when ABSENTEE_REPLAY_OWNER=worker (KYC_THRESHOLD_AMOUNT > 0)",
    );
  }

  if (
    context === "worker" &&
    config.lifecycleExecutionOwner === "worker" &&
    config.absenteeReplayOwner === "api_rollback" &&
    config.workerAbsenteeApiRollbackReady === false
  ) {
    errors.push(
      "ABSENTEE_REPLAY_OWNER=api_rollback with worker lifecycle requires CRON_INTERNAL_SECRET and API_INTERNAL_BASE_URL for replay adapter",
    );
  }

  if (config.xeroProjectorMode === "live" && config.financeCronExecutionOwner === "api_rollback") {
    errors.push(
      "XERO_PROJECTOR_MODE=live requires finance cron execution on worker (not api_rollback)",
    );
  }

  const duplicateIds = new Set<string>();
  for (const op of BACKGROUND_OPERATION_REGISTRY) {
    if (duplicateIds.has(op.id)) {
      errors.push(`duplicate background operation id: ${op.id}`);
    }
    duplicateIds.add(op.id);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function assertRuntimeOwnership(
  config: RuntimeOwnershipConfig,
  context: "api" | "worker",
): void {
  const result = validateRuntimeOwnership(config, context);
  if (!result.ok) {
    throw new Error(`runtime_ownership_invalid: ${result.errors.join("; ")}`);
  }
}
