import {
  DATA_EXPORT_QUEUE_NAME,
  DEAD_LETTER_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  LOT_LIFECYCLE_QUEUE_NAME,
  PROCESS_IMAGE_QUEUE_NAME,
  QR_CODE_SCAN_QUEUE_NAME,
  VALIDATE_UPLOAD_QUEUE_NAME,
  WEBHOOK_EVENTS_QUEUE_NAME,
} from "./queue-names.js";
import { FINANCE_CRON_QUEUE_REGISTRY } from "./registries/finance-cron.js";
import { MAINTENANCE_QUEUE_REGISTRY } from "./registries/maintenance.js";
import { MARKETING_QUEUE_REGISTRY } from "./registries/marketing.js";
import { PAYOUT_QUEUE_REGISTRY } from "./registries/payout.js";
import { PLATFORM_CRON_QUEUE_REGISTRY } from "./registries/platform-cron.js";
import type { QueueConsumer, QueueDefinition, QueueRuntimeEnv } from "./types.js";

export * from "./queue-names.js";

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
    producers: ["api", "worker"],
    consumer: "api",
    criticality: "high",
    pauseOrder: null,
    heartbeatKey: "lot-lifecycle",
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
    description:
      "Lot activate/end scheduling (worker consumer when LIFECYCLE_EXECUTION_OWNER=worker; API consumer when api)",
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
  [PROCESS_IMAGE_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: "process-image",
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
    description: "Extract image dimensions and LQIP after upload validation",
  },
  [QR_CODE_SCAN_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: "qr-code-scan",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: false,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 200,
    },
    description: "QR code scan analytics write-behind",
  },
  [WEBHOOK_EVENTS_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: "webhook-events",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 200,
      removeOnFail: 500,
    },
    description: "Webhook ingest processing (Shopify / WordPress)",
  },
  [DATA_EXPORT_QUEUE_NAME]: {
    producers: ["api"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: "data-export",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
      removeOnFail: 200,
    },
    description: "Async CSV data exports",
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
  ...MARKETING_QUEUE_REGISTRY,
  ...FINANCE_CRON_QUEUE_REGISTRY,
  ...PLATFORM_CRON_QUEUE_REGISTRY,
  ...MAINTENANCE_QUEUE_REGISTRY,
  ...PAYOUT_QUEUE_REGISTRY,
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

/** Effective BullMQ consumer for a queue given deployment ownership flags. */
export function resolveEffectiveQueueConsumer(
  queueName: QueueName,
  def: QueueDefinition,
  env: QueueRuntimeEnv,
): QueueConsumer {
  if (queueName === LOT_LIFECYCLE_QUEUE_NAME) {
    return env.lifecycleExecutionOwner === "worker" ? "worker" : "api";
  }
  return def.consumer;
}

/** Heartbeat suffix when the worker process consumes this queue. */
export function resolveWorkerHeartbeatKeyForQueue(
  queueName: QueueName,
  def: QueueDefinition,
  env: QueueRuntimeEnv,
): string | null {
  if (resolveEffectiveQueueConsumer(queueName, def, env) !== "worker") {
    return null;
  }
  return def.heartbeatKey;
}

/** Queues that should wire attachDlq() on their Worker. */
export function listWorkerHeartbeatKeys(env: QueueRuntimeEnv): string[] {
  const keys: string[] = [];
  for (const { name, def } of listEnabledQueues(env)) {
    const hb = resolveWorkerHeartbeatKeyForQueue(name, def, env);
    if (hb) {
      keys.push(`worker:heartbeat:${hb}`);
    }
  }
  // domain-events is a DB poller, not BullMQ — kept for worker /health/ready compatibility
  keys.push("worker:heartbeat:domain-events");
  return keys;
}
