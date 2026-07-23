import { describe, expect, it } from "vitest";
import { LOT_LIFECYCLE_TICK_QUEUE_NAME } from "./queue-names-platform-cron.js";
import { PLATFORM_CRON_QUEUE_REGISTRY } from "./registries/platform-cron.js";
import { QUEUE_REGISTRY } from "./registry.js";

describe("platform cron queue registry", () => {
  it("registers catalog lifecycle cron queues in the global registry", () => {
    expect(QUEUE_REGISTRY[LOT_LIFECYCLE_TICK_QUEUE_NAME]).toBeDefined();
    expect(PLATFORM_CRON_QUEUE_REGISTRY[LOT_LIFECYCLE_TICK_QUEUE_NAME].repeatable).toBe(true);
  });
});
