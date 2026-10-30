import type { Database } from "@auction/db";
import type { ShopApiEnv } from "../../env.js";
import { createPurgeRetainedInvoiceDataRunner } from "../../infrastructure/scheduler/purge-retained-invoice-data.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createRetainedInvoicePurgeTask(db: Database, env: ShopApiEnv): ShopSchedulerTask {
  const run = createPurgeRetainedInvoiceDataRunner(db, env.SHOP_FINANCIAL_YEAR_END);
  return {
    name: "retained-invoice-purge",
    run: async (now) => {
      await run(now);
    },
  };
}
