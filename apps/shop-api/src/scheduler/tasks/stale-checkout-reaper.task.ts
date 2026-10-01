import type { Database } from "@auction/db";
import type { PaymentCheckoutGateway } from "../../application/ports/commerce.ports.js";
import { reapStaleShopCheckouts } from "../../infrastructure/shop-checkout-reaper.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createStaleCheckoutReaperTask(
  db: Database,
  paymentGateway: PaymentCheckoutGateway,
): ShopSchedulerTask {
  return {
    name: "stale-checkout-reaper",
    run: (now) => reapStaleShopCheckouts(db, now, paymentGateway).then(() => undefined),
  };
}
