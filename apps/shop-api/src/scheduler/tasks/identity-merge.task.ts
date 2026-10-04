import type { Database } from "@auction/db";
import { createProcessIdentityMergeInboxRunner } from "../../infrastructure/scheduler/process-identity-merge-inbox.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createIdentityMergeTask(
  db: Database,
  opsAlertEmail: string | null,
): ShopSchedulerTask {
  const run = createProcessIdentityMergeInboxRunner(db, opsAlertEmail);
  return {
    name: "identity-merge",
    run: async () => {
      await run();
    },
  };
}
