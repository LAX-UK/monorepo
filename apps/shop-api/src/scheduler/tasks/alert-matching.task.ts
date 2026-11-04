import type { AlertMatchingService } from "../../application/alerts/alert-matching.service.js";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

/** Turns newly published editions and originals into matches, outside the publish transaction. */
export function createAlertMatchingTask(
  matching: Pick<AlertMatchingService, "run">,
): ShopSchedulerTask {
  return {
    name: "alert-matching",
    run: async () => {
      await matching.run();
    },
  };
}
