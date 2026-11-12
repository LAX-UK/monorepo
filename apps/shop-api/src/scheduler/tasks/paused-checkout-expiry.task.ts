import type { Database } from "@auction/db";
import type { CheckoutMoneyPause } from "../../application/artwork-register/checkout-money-pause.js";
import type { CheckoutTransitionOptions } from "../../infrastructure/drizzle-payment-event.processor.js";
import { expirePausedShopCheckouts } from "../../infrastructure/shop-checkout-money-pause-sweep.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

/** Ends open payment pages for artworks Zoho says are Sold or Reserved, every scheduler tick. */
export function createPausedCheckoutExpiryTask(
  db: Database,
  guard: CheckoutMoneyPause,
  options: CheckoutTransitionOptions,
): ShopSchedulerTask {
  return {
    name: "paused-checkout-expiry",
    run: () => expirePausedShopCheckouts(db, guard, options).then(() => undefined),
  };
}
