import type { Database } from "@auction/db";
import type { ShopApiEnv } from "../../env.js";
import { createDrizzleGuestOrderClaimer } from "../../infrastructure/guest-checkout/drizzle-guest-order-claimer.js";
import { createClaimGuestOrdersRunner } from "../../infrastructure/scheduler/claim-guest-orders.runner.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createGuestOrderClaimTask(db: Database, env: ShopApiEnv): ShopSchedulerTask {
  const run = createClaimGuestOrdersRunner(
    db,
    createDrizzleGuestOrderClaimer(db, { domainEventMode: env.DOMAIN_EVENT_PUBLISH_VALIDATE }),
  );
  return {
    name: "guest-order-claim",
    run: async () => {
      await run();
    },
  };
}
