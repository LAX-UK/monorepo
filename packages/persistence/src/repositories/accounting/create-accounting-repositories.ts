import type { Database } from "@auction/db";
import type {
  IStripeBooksLedger,
  IStripeReconciliationStore,
} from "../../interfaces/accounting-stripe.js";
import type {
  AccountingClock,
  IAccountingAttentionReader,
  IAccountingCreditNoteRefunds,
  IAccountingCreditNotes,
  IAccountingDocumentBrowser,
  IAccountingDocumentCopies,
  IAccountingDocumentDueWork,
  IAccountingDocumentLookup,
  IAccountingDocumentRegistry,
  IAccountingDocumentTransitions,
  IAccountingDocumentWorkQueue,
  IAccountingReleaseBasisReader,
  IAccountingRemainders,
  IAccountingSourceSettingReader,
  IAccountingSourceSettingWriter,
  IBidInvoiceBooksReader,
  IBidInvoiceEmailFactsReader,
  IPartFundedTransfersReader,
  IUnattributedRefundsReader,
} from "../../interfaces/accounting.js";
import { DrizzleAccountingAttentionReader } from "./drizzle-accounting-attention.reader.js";
import { DrizzleAccountingCreditNoteRefunds } from "./drizzle-accounting-credit-note-refunds.js";
import { DrizzleAccountingDocumentCopies } from "./drizzle-accounting-document-copies.js";
import { DrizzleAccountingDocumentBrowser } from "./drizzle-accounting-document.browser.js";
import { DrizzleAccountingDocumentDueWork } from "./drizzle-accounting-document.due-work.js";
import { DrizzleAccountingDocumentReader } from "./drizzle-accounting-document.reader.js";
import { DrizzleAccountingDocumentRegistry } from "./drizzle-accounting-document.registry.js";
import { DrizzleAccountingDocumentTransitions } from "./drizzle-accounting-document.transitions.js";
import { DrizzleAccountingDocumentWorkQueue } from "./drizzle-accounting-document.work-queue.js";
import { DrizzleAccountingReleaseBasisReader } from "./drizzle-accounting-release-basis.reader.js";
import { DrizzleAccountingRemainders } from "./drizzle-accounting-remainders.js";
import { DrizzleAccountingSourceSettingReader } from "./drizzle-accounting-source-setting.reader.js";
import { DrizzleAccountingSourceSettingWriter } from "./drizzle-accounting-source-setting.writer.js";
import { DrizzleBidInvoiceBooksReader } from "./drizzle-bid-invoice-books.reader.js";
import { DrizzleBidInvoiceEmailFactsReader } from "./drizzle-bid-invoice-email-facts.reader.js";
import { DrizzlePartFundedTransfersReader } from "./drizzle-part-funded-transfers.reader.js";
import {
  DrizzleStripeBooksLedger,
  DrizzleStripeReconciliationStore,
} from "./drizzle-stripe-books.js";
import { DrizzleUnattributedRefundsReader } from "./drizzle-unattributed-refunds.reader.js";

/** Each role's process takes the ports it is granted; the interfaces are what callers depend on. */
export interface AccountingRepositories {
  readonly lookup: IAccountingDocumentLookup;
  /** The credit notes registered for an invoice in one books (the worker's projection). */
  readonly creditNotes: IAccountingCreditNotes;
  /** A refund credit note's money refunded in the books from Stripe clearing (the worker). */
  readonly creditNoteRefunds: IAccountingCreditNoteRefunds;
  readonly registry: IAccountingDocumentRegistry;
  readonly transitions: IAccountingDocumentTransitions;
  readonly workQueue: IAccountingDocumentWorkQueue;
  readonly dueWork: IAccountingDocumentDueWork;
  readonly settingReader: IAccountingSourceSettingReader;
  readonly settingWriter: IAccountingSourceSettingWriter;
  readonly browser: IAccountingDocumentBrowser;
  readonly attention: IAccountingAttentionReader;
  /** LAX's stored copies of issued documents, and the email queued from each (the worker). */
  readonly copies: IAccountingDocumentCopies;
  /** A payment's unapplied rest applied to a delivery invoice issued after it (the worker). */
  readonly remainders: IAccountingRemainders;
  /** What the "Your invoice" email says (the worker). */
  readonly invoiceEmailFacts: IBidInvoiceEmailFactsReader;
  /** One Bid invoice's Books documents and copies, for the buyer's card (the Bid API). */
  readonly bidInvoiceBooks: IBidInvoiceBooksReader;
  /** Bank transfers part received, for the Accounting page (the Bid API). */
  readonly partFunded: IPartFundedTransfersReader;
  /** "Pay several" refunds no invoice or quote could take, for the Accounting page (the Bid API). */
  readonly unattributedRefunds: IUnattributedRefundsReader;
  /** The rows a release of a parked document is decided on (the Bid API). */
  readonly releaseBasis: IAccountingReleaseBasisReader;
  /** Stripe fees and payouts, read daily and booked once each (the worker). */
  readonly stripeLedger: IStripeBooksLedger;
  /** What the daily reconciliation report reads, and where each report was stored (the worker). */
  readonly reconciliation: IStripeReconciliationStore;
}

/** The one place the accounting repositories are assembled (container registration). */
export function createAccountingRepositories(
  db: Database,
  clock: AccountingClock,
): AccountingRepositories {
  const reader = new DrizzleAccountingDocumentReader(db, clock);
  return {
    lookup: reader,
    creditNotes: reader,
    creditNoteRefunds: new DrizzleAccountingCreditNoteRefunds(db, clock),
    registry: new DrizzleAccountingDocumentRegistry(db, clock),
    transitions: new DrizzleAccountingDocumentTransitions(db, clock),
    workQueue: new DrizzleAccountingDocumentWorkQueue(db, clock),
    dueWork: new DrizzleAccountingDocumentDueWork(db, clock),
    settingReader: new DrizzleAccountingSourceSettingReader(db),
    settingWriter: new DrizzleAccountingSourceSettingWriter(db, clock),
    browser: new DrizzleAccountingDocumentBrowser(db, clock),
    attention: new DrizzleAccountingAttentionReader(db),
    copies: new DrizzleAccountingDocumentCopies(db, clock),
    remainders: new DrizzleAccountingRemainders(db, clock),
    invoiceEmailFacts: new DrizzleBidInvoiceEmailFactsReader(db),
    bidInvoiceBooks: new DrizzleBidInvoiceBooksReader(db, clock),
    partFunded: new DrizzlePartFundedTransfersReader(db),
    unattributedRefunds: new DrizzleUnattributedRefundsReader(db),
    releaseBasis: new DrizzleAccountingReleaseBasisReader(db),
    stripeLedger: new DrizzleStripeBooksLedger(db, clock),
    reconciliation: new DrizzleStripeReconciliationStore(db),
  };
}
