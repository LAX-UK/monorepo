import type { Database } from "@auction/db";
import { createPurgeRetainedInvoiceDataRunner } from "../../infrastructure/scheduler/purge-retained-invoice-data.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createRetainedInvoicePurgeTask(db: Database): ShopSchedulerTask {
  const run = createPurgeRetainedInvoiceDataRunner(db);
  return {
    name: "retained-invoice-purge",
    run: async (now) => {
      await run(now);
    },
  };
}
