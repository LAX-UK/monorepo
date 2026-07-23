import {
  LOT_LIFECYCLE_TICK_QUEUE_NAME,
  PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME,
  STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME,
} from "../queue-names-platform-cron.js";
import type { QueueDefinition } from "../types.js";

/** Catalog/platform lifecycle cron proxies (worker → API internal/jobs). */
export const PLATFORM_CRON_QUEUE_REGISTRY = {
  [PROCESS_NOTIFICATION_OUTBOX_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "high",
    pauseOrder: null,
    heartbeatKey: "process-notification-outbox",
    dlq: false,
    showInUi: false,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 15_000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
    description: "Drain critical notification outbox (API cron proxy)",
  },
  [LOT_LIFECYCLE_TICK_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "high",
    pauseOrder: null,
    heartbeatKey: "lot-lifecycle-tick",
    dlq: false,
    showInUi: false,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
    description: "Lot/sale lifecycle tick (API cron proxy)",
  },
  [STALE_SUBMISSION_DRAFT_REMINDERS_QUEUE_NAME]: {
    producers: ["worker"],
    consumer: "worker",
    criticality: "background",
    pauseOrder: null,
    heartbeatKey: "stale-submission-draft-reminders",
    dlq: false,
    showInUi: false,
    allowUiRetries: false,
    repeatable: true,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 120_000 },
      removeOnComplete: 50,
      removeOnFail: 50,
    },
    description: "Nudge sellers with stale draft submissions",
  },
} as const satisfies Record<string, QueueDefinition>;
