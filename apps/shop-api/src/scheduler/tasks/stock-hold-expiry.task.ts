import type { Database } from "@auction/db";
import { createExpireHoldsRunner } from "../../infrastructure/scheduler/expire-holds.runner.js";
import type { ShopDomainEventPublisherMode } from "../../infrastructure/shop-domain-event-publisher.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createStockHoldExpiryTask(
  db: Database,
  domainEventMode: ShopDomainEventPublisherMode = "off",
): ShopSchedulerTask {
  const expireHolds = createExpireHoldsRunner(db, domainEventMode);
  return {
    name: "stock-hold-expiry",
    run: async (now) => {
      await expireHolds(now);
    },
  };
}
