import type { IProjectorCursorStart } from "../../repositories/drizzle-projector-cursor-start.js";
import type { AccountingProjection } from "./accounting-projection.service.js";
import type { AccountingSender } from "./accounting-sender.service.js";
import type { AccountingWatch } from "./accounting-watch.service.js";

/** What the accounting projector and sender run with; absent when Books is not configured. */
export interface AccountingRuntime {
  readonly projection: AccountingProjection;
  readonly sender: AccountingSender;
  readonly cursorStart: IProjectorCursorStart;
  /** Checks the queue for work waiting too long; run by the accounting-watch cron. */
  readonly watch: AccountingWatch;
  /** Wraps a sender tick in its cron monitor check-in (throttled; see `throttledCronMonitor`). */
  readonly senderCheckIn: (tick: () => Promise<void>) => Promise<void>;
}
