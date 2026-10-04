import type { Database } from "@auction/db";
import { createRunPayoutEligibilityHandler } from "../../infrastructure/handlers/scheduler/run-payout-eligibility.handler.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createPayoutEligibilityTask(db: Database): ShopSchedulerTask {
  const run = createRunPayoutEligibilityHandler(db);
  return {
    name: "payout-eligibility",
    run: async (now) => {
      await run(now);
    },
  };
}
