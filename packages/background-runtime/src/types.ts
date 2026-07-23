export type RuntimeExecutionOwner = "worker" | "api_rollback";

export type BackgroundOperationKind =
  | "finance_cron"
  | "lifecycle_tick"
  | "lifecycle_queue"
  | "domain_event_projector"
  | "webhook_inbound";

export type BackgroundOperationDefinition = {
  id: string;
  kind: BackgroundOperationKind;
  /** Intended production owner once cutover completes. */
  targetOwner: RuntimeExecutionOwner;
  internalJobPath?: string;
  description: string;
};

export type RuntimeOwnershipConfig = {
  financeCronExecutionOwner: RuntimeExecutionOwner;
  lifecycleExecutionOwner: "api" | "worker";
  absenteeReplayOwner: "api_rollback" | "worker";
  xeroProjectorMode: "off" | "shadow" | "canary" | "live";
  financeCronApiRollbackEnabled: boolean;
  /** When worker owns finance cron, local handlers must be wired (not API HTTP fallback). */
  workerFinanceCronHandlersReady?: boolean;
  workerLifecycleHandlersReady?: boolean;
  workerAbsenteeReplayReady?: boolean;
  /** CRON secret + API URL when absentee replay uses explicit API rollback. */
  workerAbsenteeApiRollbackReady?: boolean;
  /** KYC threshold gate active when worker owns absentee replay. */
  workerBidKycEnforcementReady?: boolean;
};
