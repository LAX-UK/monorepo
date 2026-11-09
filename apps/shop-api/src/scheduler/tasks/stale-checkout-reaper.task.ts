import type { Database } from "@auction/db";
import type { CheckoutTransitionOptions } from "../../infrastructure/drizzle-payment-event.processor.js";
import { reapStaleShopCheckouts } from "../../infrastructure/shop-checkout-reaper.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createStaleCheckoutReaperTask(
  db: Database,
  options: CheckoutTransitionOptions,
): ShopSchedulerTask {
  return {
    name: "stale-checkout-reaper",
    run: (now) => reapStaleShopCheckouts(db, now, options).then(() => undefined),
  };
}
