import type { Database } from "@auction/db";
import { reapStaleShopCheckouts } from "../../infrastructure/shop-checkout-reaper.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createStaleCheckoutReaperTask(db: Database): ShopSchedulerTask {
  return {
    name: "stale-checkout-reaper",
    run: (now) => reapStaleShopCheckouts(db, now).then(() => undefined),
  };
}
