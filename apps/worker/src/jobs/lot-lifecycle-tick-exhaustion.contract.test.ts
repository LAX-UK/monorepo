import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOT_LIFECYCLE_TICK_QUEUE_NAME, QUEUE_REGISTRY } from "@auction/queues";
import { describe, expect, it } from "vitest";

const financeCronSource = readFileSync(
  join(import.meta.dirname, "../workers/register-finance-cron-workers.ts"),
  "utf8",
);

describe("lot-lifecycle-tick exhaustion policy", () => {
  it("does not register BullMQ DLQ (repeatable cron proxy / worker-owned tick)", () => {
    const def = QUEUE_REGISTRY[LOT_LIFECYCLE_TICK_QUEUE_NAME];
    expect(def.dlq).toBe(false);
    expect(def.repeatable).toBe(true);
  });

  it("reports exhausted attempts via worker job failure hook (Sentry + structured log)", () => {
    expect(financeCronSource).toContain("reportWorkerJobFailure(LOT_LIFECYCLE_TICK_QUEUE_NAME");
  });
});
