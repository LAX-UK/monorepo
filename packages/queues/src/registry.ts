import type { QueueDefinition, QueueRuntimeEnv } from "./types.js";

/** Shared dead-letter queue for exhausted retries (not a per-queue `-dlq` suffix). */
export const DEAD_LETTER_QUEUE_NAME = "dead-letter" as const;

export const LOT_LIFECYCLE_QUEUE_NAME = "lot-lifecycle" as const;
export const EMAIL_QUEUE_NAME = "email" as const;
export const VALIDATE_UPLOAD_QUEUE_NAME = "validate-upload" as const;
export const IMAGE_CLEANUP_QUEUE_NAME = "image-cleanup" as const;
export const MARKETING_SYNC_QUEUE_NAME = "marketing-sync" as const;
export const MARKETING_EVENTS_QUEUE_NAME = "marketing-events" as const;
export const MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME = "marketing-events-capi-batch" as const;
export const MARKETING_OUTBOX_POLLER_QUEUE_NAME = "marketing-outbox-poller" as const;
export const PURGE_MARKETING_CLICK_IDS_QUEUE_NAME = "purge-marketing-click-ids" as const;
export const WEBHOOK_EVENTS_QUEUE_NAME = "webhook-events" as const;
export const GC_PENDING_UPLOADS_QUEUE_NAME = "gc-pending-uploads" as const;
export const IMPERSONATION_SWEEPER_QUEUE_NAME = "impersonation-sweeper" as const;
export const PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME = "purge-expired-verifications" as const;
export const PURGE_SOFT_DELETED_USERS_QUEUE_NAME = "purge-soft-deleted-users" as const;
export const PAYOUT_SETTLEMENT_QUEUE_NAME = "payout-settlement" as const;
export const PAYOUT_STATEMENTS_QUEUE_NAME = "payout-statements" as const;
export const LEGAL_ENTITY_ARCHIVE_QUEUE_NAME = "legal-entity-archive" as const;

const marketingEnabled = (env: QueueRuntimeEnv) => env.marketingEventsEnabled;
const cronEnabled = (env: QueueRuntimeEnv) => Boolean(env.cronInternalSecret?.trim());

/**
 * Single source of truth for BullMQ queue metadata.
 * `domain-events` is intentionally excluded — it is a DB poller, not BullMQ.
 */
export const QUEUE_REGISTRY = {
  [EMAIL_QUEUE_NAME]: {
    producers: ["api", "auth", "worker"],
    consumer: "worker",
    criticality: "high",
    pauseOrder: 6,
    heartbeatKey: "email",
    dlq: true,
    showInUi: false,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
    description: "Transactional + outbox email delivery",
  },
  [LOT_LIFECYCLE_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "api",
    criticality: "high",
    pauseOrder: null,
    heartbeatKey: null,
    dlq: true,
    showInUi: true,
    allowUiRetries: false,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    },
    description: "Lot activate/end scheduling (runs in apps/api)",
  },
  [VALIDATE_UPLOAD_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: "validate-upload",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
    description: "Upload validation after S3 confirm",
  },
  [IMAGE_CLEANUP_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: "image-cleanup",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
    description: "Orphan object deletion",
  },
  [MARKETING_SYNC_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: "marketing-sync",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
    description: "Newsletter signup → Zoho Campaigns",
  },
  [MARKETING_EVENTS_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "high",
    pauseOrder: null,
    heartbeatKey: "marketing-events",
    dlq: true,
    showInUi: true,
    allowUiRetries: false,
    repeatable: false,
    enabledWhen: marketingEnabled,
    defaultJobOptions: {
      attempts: 10,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
    description: "Marketing event publish (sGTM + Meta CAPI)",
  },
  [MARKETING_EVENTS_CAPI_BATCH_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: null,
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: false,
    enabledWhen: marketingEnabled,
    defaultJobOptions: {
      attempts: 10,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
    description: "Meta CAPI batch collector",
  },
  [MARKETING_OUTBOX_POLLER_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: null,
    dlq: false,
    showInUi: true,
    allowUiRetries: false,
    repeatable: true,
    enabledWhen: marketingEnabled,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 10,
      removeOnFail: 100,
    },
    description: "Re-enqueue stuck marketing outbox rows",
  },
  [PURGE_MARKETING_CLICK_IDS_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: null,
    dlq: false,
    showInUi: true,
    allowUiRetries: false,
    repeatable: true,
    enabledWhen: marketingEnabled,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 5,
      removeOnFail: 50,
    },
    description: "Purge stale marketing click IDs and outbox",
  },
  [WEBHOOK_EVENTS_QUEUE_NAME]: {
    producers: [],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: "webhook-events",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
    description: "Webhook ingest (Phase 2 — no producer yet)",
  },
  [GC_PENDING_UPLOADS_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: "gc-pending-uploads",
    dlq: false,
    showInUi: true,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 10,
      removeOnFail: 50,
    },
    description: "Hourly GC for pending uploads",
  },
  [IMPERSONATION_SWEEPER_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: 4,
    heartbeatKey: "impersonation-sweeper",
    dlq: false,
    showInUi: true,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 10,
      removeOnFail: 50,
    },
    description: "Sweep stale impersonation sessions",
  },
  [PURGE_EXPIRED_VERIFICATIONS_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: "purge-expired-verifications",
    dlq: false,
    showInUi: true,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 10,
      removeOnFail: 50,
    },
    description: "Purge expired KYC verifications",
  },
  [PURGE_SOFT_DELETED_USERS_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: null,
    dlq: false,
    showInUi: true,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 10,
      removeOnFail: 50,
    },
    description: "Weekly purge of soft-deleted users",
  },
  [PAYOUT_SETTLEMENT_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "high",
    pauseOrder: 1,
    heartbeatKey: "payout-settlement",
    dlq: true,
    showInUi: true,
    allowUiRetries: false,
    repeatable: true,
    enabledWhen: cronEnabled,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
    description: "Weekly bulk payout settlement cron",
  },
  [PAYOUT_STATEMENTS_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "high",
    pauseOrder: 2,
    heartbeatKey: "payout-statements",
    dlq: true,
    showInUi: true,
    allowUiRetries: false,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
      removeOnComplete: 50,
      removeOnFail: 200,
    },
    description: "Generate payout statement PDFs",
  },
  [LEGAL_ENTITY_ARCHIVE_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "high",
    pauseOrder: 3,
    heartbeatKey: "legal-entity-archive",
    dlq: true,
    showInUi: true,
    allowUiRetries: false,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 500,
    },
    description: "Legal entity archive cascade",
  },
  [DEAD_LETTER_QUEUE_NAME]: {
    producers: ["api", "worker"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: null,
    dlq: false,
    showInUi: true,
    allowUiRetries: false,
    repeatable: false,
    defaultJobOptions: {
      attempts: 1,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 30 * 24 * 3600, count: 1000 },
      removeOnFail: false,
    },
    description: "Exhausted-retry jobs for inspection and replay",
  },
} as const satisfies Record<string, QueueDefinition>;

export type QueueName = keyof typeof QUEUE_REGISTRY;

export const ALL_QUEUE_NAMES = Object.keys(QUEUE_REGISTRY) as QueueName[];

export function isQueueName(value: string): value is QueueName {
  return Object.hasOwn(QUEUE_REGISTRY, value);
}

export function getQueueDefinition(name: QueueName): QueueDefinition {
  return QUEUE_REGISTRY[name];
}

export function listEnabledQueues(
  env: QueueRuntimeEnv,
): Array<{ name: QueueName; def: QueueDefinition }> {
  return ALL_QUEUE_NAMES.filter((name) => {
    const def = getQueueDefinition(name);
    return def.enabledWhen?.(env) ?? true;
  }).map((name) => ({ name, def: getQueueDefinition(name) }));
}

export function listBullBoardQueues(
  env: QueueRuntimeEnv,
): Array<{ name: QueueName; def: QueueDefinition }> {
  return listEnabledQueues(env).filter(({ def }) => def.showInUi);
}

export function listDlqSourceQueues(): Array<{ name: QueueName; def: QueueDefinition }> {
  return ALL_QUEUE_NAMES.filter((name) => QUEUE_REGISTRY[name].dlq).map((name) => ({
    name,
    def: QUEUE_REGISTRY[name],
  }));
}

export function heartbeatRedisKey(queueName: QueueName): string | null {
  const key = QUEUE_REGISTRY[queueName].heartbeatKey;
  return key ? `worker:heartbeat:${key}` : null;
}

/** Queues that should wire attachDlq() on their Worker. */
export function listWorkerHeartbeatKeys(env: QueueRuntimeEnv): string[] {
  const keys: string[] = [];
  for (const { def } of listEnabledQueues(env)) {
    if (def.heartbeatKey && def.consumer === "worker") {
      keys.push(`worker:heartbeat:${def.heartbeatKey}`);
    }
  }
  // domain-events is a DB poller, not BullMQ — kept for worker /health/ready compatibility
  keys.push("worker:heartbeat:domain-events");
  return keys;
}
