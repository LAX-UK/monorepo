import type { FastifyBaseLogger } from "fastify";
import type { createRunConnectPayoutTransfersHandler } from "../../infrastructure/handlers/scheduler/run-connect-payout-transfers.handler.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

export function createConnectPayoutTransferTask(
  run: ReturnType<typeof createRunConnectPayoutTransfersHandler>,
  log: FastifyBaseLogger,
): ShopSchedulerTask {
  return {
    name: "connect-payout-transfer",
    run: async () => {
      const result = await run();
      for (const failure of result.failed) {
        log.error(failure, "shop_connect_payout_transfer_failed");
      }
      if (result.transferred > 0) {
        log.info({ transferred: result.transferred }, "shop_connect_payout_transfers_created");
      }
    },
  };
}
