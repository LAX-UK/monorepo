export type QueueCriticality = "high" | "normal" | "background";
export type QueueProducer = "api" | "auth" | "worker";
export type QueueConsumer = "api" | "worker";

export type QueueJobOptions = {
  attempts: number;
  backoff: { type: "exponential"; delay: number };
  removeOnComplete: number | { age: number; count: number };
  removeOnFail: number | false;
};

/** Minimal runtime env for conditional queue visibility (api, worker, auth). */
export type QueueRuntimeEnv = {
  appEnv: "production" | "test" | "development";
  cronInternalSecret?: string | undefined;
  marketingEventsEnabled: boolean;
};

export type QueueDefinition = {
  producers: readonly QueueProducer[];
  consumer: QueueConsumer;
  criticality: QueueCriticality;
  /** Pause order from scale-monitoring runbook; null = not safe to pause via UI. */
  pauseOrder: number | null;
  /** Redis heartbeat key suffix after `worker:heartbeat:`; null when no heartbeat. */
  heartbeatKey: string | null;
  dlq: boolean;
  showInUi: boolean;
  allowUiRetries: boolean;
  repeatable: boolean;
  defaultJobOptions: QueueJobOptions;
  description: string;
  enabledWhen?: (env: QueueRuntimeEnv) => boolean;
};
