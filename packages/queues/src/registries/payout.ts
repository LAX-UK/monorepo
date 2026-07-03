import {
  LEGAL_ENTITY_ARCHIVE_QUEUE_NAME,
  PAYOUT_SETTLEMENT_QUEUE_NAME,
  PAYOUT_STATEMENTS_QUEUE_NAME,
} from "../queue-names.js";
import type { QueueDefinition, QueueRuntimeEnv } from "../types.js";

const cronEnabled = (env: QueueRuntimeEnv) => Boolean(env.cronInternalSecret?.trim());

export const PAYOUT_QUEUE_REGISTRY = {
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
} as const satisfies Record<string, QueueDefinition>;
