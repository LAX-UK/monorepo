import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertWorkerLifecycleHandlersAreLocal } from "@auction/background-runtime";
import { describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("lifecycle ownership matrix", () => {
  it("worker lot lifecycle job handler does not call API cron", () => {
    const source = readFileSync(join(root, "lifecycle/process-lot-lifecycle-job.ts"), "utf8");
    assertWorkerLifecycleHandlersAreLocal(source);
  });

  it("api rollback absentee adapter is explicit in worker absentee module", () => {
    const source = readFileSync(join(root, "bidding/create-worker-absentee-replay.ts"), "utf8");
    expect(source).toContain("createApiRollbackAbsenteeReplayPort");
    expect(source).toContain('ABSENTEE_REPLAY_OWNER === "worker"');
  });
});
