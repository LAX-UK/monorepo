import { ATG_SYNC_QUEUE_NAME } from "../queue-names.js";
import type { QueueDefinition } from "../types.js";

/** ATG White Label sync; exists only while ATG_SYNC_ENABLED is on. */
export const ATG_QUEUE_REGISTRY = {
  [ATG_SYNC_QUEUE_NAME]: {
    producers: ["api", "worker"],
    consumer: "worker",
    criticality: "normal",
    pauseOrder: null,
    heartbeatKey: "atg-sync",
    dlq: false,
    showInUi: true,
    allowUiRetries: true,
    repeatable: true,
    defaultJobOptions: {
      attempts: 4,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
      removeOnFail: 500,
    },
    description: "ATG White Label push/publish/close and results polling",
    enabledWhen: (env) => env.atgSyncEnabled === true,
  },
} as const satisfies Record<string, QueueDefinition>;
