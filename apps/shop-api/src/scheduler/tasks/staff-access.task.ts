import type { Database } from "@auction/db";
import { createProcessStaffAccessInboxRunner } from "../../infrastructure/scheduler/process-staff-access-inbox.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createStaffAccessTask(
  db: Database,
  opsAlertEmail: string | null,
): ShopSchedulerTask {
  const run = createProcessStaffAccessInboxRunner(db, opsAlertEmail);
  return {
    name: "staff-access",
    run: async () => {
      await run();
    },
  };
}
