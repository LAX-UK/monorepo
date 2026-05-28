import type { QueueDefinition } from "./types.js";
import { QUEUE_REGISTRY, type QueueName } from "./registry.js";

/** Merge registry default job options onto BullMQ Queue/Worker constructor opts. */
export function createBullQueueOptions<T extends Record<string, unknown>>(
  name: QueueName,
  base: T,
): T & { defaultJobOptions: QueueDefinition["defaultJobOptions"] } {
  return {
    ...base,
    defaultJobOptions: QUEUE_REGISTRY[name].defaultJobOptions,
  };
}
