import type { IProjectorCursorStart } from "../../repositories/drizzle-projector-cursor-start.js";
import type { AccountingCreditNoteRefund } from "./accounting-credit-note-refund.service.js";
import type { AccountingInvoiceCopy } from "./accounting-invoice-copy.service.js";
import type { AccountingProjection } from "./accounting-projection.service.js";
import type { AccountingRemainder } from "./accounting-remainder.service.js";
import type { AccountingSender } from "./accounting-sender.service.js";
import type { AccountingWatch } from "./accounting-watch.service.js";

/** What the accounting projector and sender run with; absent when Books is not configured. */
export interface AccountingRuntime {
  readonly projection: AccountingProjection;
  readonly sender: AccountingSender;
  /** Keeps LAX's copy of each issued invoice's PDF and emails it to the buyer once (not in dry run). */
  readonly invoiceCopy: AccountingInvoiceCopy;
  /** Applies a Shop order payment's unapplied rest to its delivery invoice once that is issued. */
  readonly remainder: AccountingRemainder;
  /** Refunds a refund's credit note from Stripe clearing once it is issued. */
  readonly creditNoteRefund: AccountingCreditNoteRefund;
  readonly cursorStart: IProjectorCursorStart;
  /** Checks the queue for work waiting too long; run by the accounting-watch cron. */
  readonly watch: AccountingWatch;
  /** Wraps a sender tick in its cron monitor check-in (throttled; see `throttledCronMonitor`). */
  readonly senderCheckIn: (tick: () => Promise<void>) => Promise<void>;
}
