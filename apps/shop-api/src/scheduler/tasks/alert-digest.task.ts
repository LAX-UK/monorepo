import { type DigestRun, type SendMode, isDigestDue } from "@auction/alerts";
import type { ShopSchedulerTask } from "../shop-scheduler-task.js";

const MINUTE_MS = 60 * 1000;
/** A sending run may retry through the whole 08:00 hour; a dry run only needs to show itself once. */
const WINDOW_MS: Record<Exclude<SendMode, "off">, number> = {
  on: 60 * MINUTE_MS,
  dry_run: 5 * MINUTE_MS,
};

/**
 * Whether London time is within `widthMs` after the digest time. The scheduler ticks all day, but
 * the digest goes out once, around 08:00: a person's one-a-day cap is kept by the ledger, and the
 * window keeps a restart in the afternoon from sending a second round early.
 */
export function isInDigestWindow(now: Date, widthMs: number): boolean {
  return isDigestDue(now) && !isDigestDue(new Date(now.getTime() - widthMs));
}

/** Sends the daily digest for each product, at 08:00 London time. */
export function createAlertDigestTask(input: {
  mode: SendMode;
  runs: readonly Pick<DigestRun, "run">[];
}): ShopSchedulerTask {
  return {
    name: "alert-digest",
    run: async (now) => {
      if (input.mode === "off" || !isInDigestWindow(now, WINDOW_MS[input.mode])) return;
      for (const run of input.runs) await run.run(input.mode);
    },
  };
}
