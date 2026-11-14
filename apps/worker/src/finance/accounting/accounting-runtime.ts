import type { IProjectorCursorStart } from "../../repositories/drizzle-projector-cursor-start.js";
import type { AccountingInvoiceCopy } from "./accounting-invoice-copy.service.js";
import type { AccountingProjection } from "./accounting-projection.service.js";
import type { AccountingRemainder } from "./accounting-remainder.service.js";
import type { AccountingSender } from "./accounting-sender.service.js";
import type { AccountingWatch } from "./accounting-watch.service.js";
import type { StripeBooksSync } from "./stripe-books-sync.service.js";
import type { StripeReconciliation } from "./stripe-reconciliation.service.js";

/** What the accounting projector and sender run with; absent when Books is not configured. */
export interface AccountingRuntime {
  readonly projection: AccountingProjection;
  readonly sender: AccountingSender;
  /** Keeps LAX's copy of each issued invoice's PDF and emails it to the buyer once (not in dry run). */
  readonly invoiceCopy: AccountingInvoiceCopy;
  /** Applies a Shop order payment's unapplied rest to its delivery invoice once that is issued. */
  readonly remainder: AccountingRemainder;
  readonly cursorStart: IProjectorCursorStart;
  /** Checks the queue for work waiting too long; run by the accounting-watch cron. */
  readonly watch: AccountingWatch;
  /** Daily: Stripe's fees and payouts, read from Stripe and registered for Books once each. */
  readonly stripeSync: StripeBooksSync;
  /** Daily, after the sync: each company's reconciliation report, stored privately. */
  readonly reconciliation: StripeReconciliation;
  /** Wraps a sender tick in its cron monitor check-in (throttled; see `throttledCronMonitor`). */
  readonly senderCheckIn: (tick: () => Promise<void>) => Promise<void>;
}
