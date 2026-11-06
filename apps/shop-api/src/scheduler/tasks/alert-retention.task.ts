import { type AlertRetentionStore, pruneAlertRetention } from "@auction/alerts";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

/** The prune runs in this UTC hour, well away from the 08:00 London digest. */
export const ALERT_RETENTION_HOUR_UTC = 3;

type Logger = Parameters<typeof pruneAlertRetention>[0]["log"];

/**
 * Prunes Shop's and lax.art's stale alert sign-ups and old alert logs once a day, by the rules in
 * `@auction/alerts`. The scheduler ticks all day; this runs in one hour and not again that day once
 * it has succeeded. A failure is retried on the next tick in the hour.
 */
export function createAlertRetentionTask(input: {
  store: AlertRetentionStore;
  log: Logger;
}): ShopSchedulerTask {
  let lastDoneDay: string | null = null;
  return {
    name: "alert-retention",
    run: async (now) => {
      const day = now.toISOString().slice(0, 10);
      if (now.getUTCHours() !== ALERT_RETENTION_HOUR_UTC || lastDoneDay === day) return;
      await pruneAlertRetention({ stores: [input.store], log: input.log, now });
      lastDoneDay = day;
    },
  };
}
