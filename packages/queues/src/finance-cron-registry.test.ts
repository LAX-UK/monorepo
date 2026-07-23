import { describe, expect, it } from "vitest";
import { EXPIRE_STALE_PAYMENTS_QUEUE_NAME } from "./queue-names-finance-cron.js";
import { LOT_LIFECYCLE_TICK_QUEUE_NAME } from "./queue-names-platform-cron.js";
import { FINANCE_CRON_QUEUE_REGISTRY } from "./registries/finance-cron.js";
import { QUEUE_REGISTRY } from "./registry.js";

describe("finance cron queue registry", () => {
  it("registers finance cron queues in the global registry", () => {
    expect(QUEUE_REGISTRY[EXPIRE_STALE_PAYMENTS_QUEUE_NAME]).toBeDefined();
    expect(QUEUE_REGISTRY[LOT_LIFECYCLE_TICK_QUEUE_NAME]).toBeDefined();
    expect(FINANCE_CRON_QUEUE_REGISTRY[EXPIRE_STALE_PAYMENTS_QUEUE_NAME].repeatable).toBe(true);
  });
});
