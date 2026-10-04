import type { Database } from "@auction/db";
import { createAdminCommandPruneRunner } from "../../infrastructure/scheduler/admin-command-prune.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createAdminCommandPruneTask(db: Database): ShopSchedulerTask {
  const prune = createAdminCommandPruneRunner(db);
  return {
    name: "admin-command-prune",
    run: async (now) => {
      await prune(now);
    },
  };
}
