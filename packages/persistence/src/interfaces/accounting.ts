import type {
  AccountingDocument,
  BidInvoiceFacts,
  BidPaymentFacts,
  BidPaymentGroupFacts,
  BidRefundsFacts,
  DocumentKind,
  DocumentRecord,
  DocumentTarget,
  IssueOutcome,
  LegalEntity,
  LifecycleCode,
  LookupOutcome,
  Mode,
  ParkReason,
  Product,
  QueueTab,
  Result,
  Source,
  SwitchCode,
  SwitchConfig,
  TargetMode,
  Totals,
} from "@auction/accounting-domain";

/** The clock the accounting repositories read. Injected so tests and callers choose the time. */
export interface AccountingClock {
  now(): Date;
}

export type AccountingProvider = Source;

/** A stored document: its life-cycle record (as the domain defines it) beside the document itself. */
export interface StoredAccountingDocument {
  readonly id: string;
  readonly product: Product;
  readonly legalEntity: LegalEntity;
  readonly kind: DocumentKind;
  readonly reference: string;
  readonly sourceEventRef: string;
  readonly document: AccountingDocument;
  readonly totals: Totals;
  /** Where the document was last sent; null until the first claim. */
  readonly provider: AccountingProvider | null;
  /** The provider and mode the document was created for; null if none could be chosen. Never changes. */
  readonly target: DocumentTarget | null;
  readonly record: DocumentRecord;
  /** The last failure's class, kept after a requeue so history is not lost. */
  readonly lastErrorClass: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type StoredDocumentCode = "bad_stored_document";
export type RegisterCode = "bad_document" | "reference_in_use";
export type TransitionCode = LifecycleCode | "not_found" | StoredDocumentCode;

export interface RegisterInput {
  /** Built by the domain's constructors; checked again against the domain's rules before it is stored. */
  readonly document: AccountingDocument;
  /** The event or row that caused this document, e.g. a domain event id. */
  readonly sourceEventRef: string;
  /**
   * Store it parked (needs_review, never sent) for this reason instead of queueing it. Only a new
   * document is parked; a replay keeps the state it was first stored in.
   */
  readonly park?: ParkReason;
}

export interface RegisterOutcome {
  /** False when the reference was already registered with the same document (a replay). */
  readonly created: boolean;
  readonly stored: StoredAccountingDocument;
}

/** Add a document to the queue. Idempotent per reference and target (the switch's current one). */
export interface IAccountingDocumentRegistry {
  register(input: RegisterInput): Promise<Result<RegisterOutcome, RegisterCode>>;
}

/**
 * Look a document up by its LAX reference (the product says which legal entity's books). A
 * reference is held once per target, so pass the target (null for the row with none) to read that
 * one; without it the most recently created document for the reference is returned.
 */
export interface IAccountingDocumentLookup {
  findByReference(
    product: Product,
    reference: string,
    target?: DocumentTarget | null,
  ): Promise<Result<StoredAccountingDocument | null, StoredDocumentCode>>;
}

/**
 * One life-cycle move, named after the domain function it calls. `startSending` is not here: the
 * work queue takes the lease.
 */
export type DocumentTransition =
  | { readonly action: "expire_lease" }
  | {
      readonly action: "complete_sending";
      readonly leaseToken: string;
      readonly outcome: IssueOutcome;
    }
  | { readonly action: "apply_lookup"; readonly outcome: LookupOutcome }
  | { readonly action: "escalate"; readonly reason: string }
  /** A claimed send the sender decided not to make; recorded in the history as an escalation. */
  | { readonly action: "withhold"; readonly leaseToken: string; readonly reason: string }
  /** `requestedBy` is the staff user who asked, kept in the history row; absent for the sender's own retries. */
  | { readonly action: "requeue"; readonly requestedBy?: string }
  /**
   * A parked document whose reason is settled, queued again by the staff user who asked. The
   * caller has checked the stored rows (`resolveParked`); `document` replaces the parked draft
   * (same kind and LAX reference) when it was rebuilt, and is absent when it is unchanged.
   */
  | {
      readonly action: "release";
      readonly requestedBy: string;
      readonly document?: AccountingDocument;
    }
  /** A queued document that can never be sent as it stands, parked for a person. */
  | { readonly action: "park"; readonly reason: ParkReason }
  | { readonly action: "cancel" };

/**
 * Move a document along its life cycle. The pure domain function decides; the new state and its
 * history row are written together or not at all. Anything the domain refuses is returned as its
 * refusal and nothing is written. A lookup after an unknown outcome must ask the provider stored
 * on the document (`StoredAccountingDocument.provider`), never whichever provider the switch names
 * now: the first request went to that one.
 */
export interface IAccountingDocumentTransitions {
  apply(
    documentId: string,
    transition: DocumentTransition,
  ): Promise<Result<StoredAccountingDocument, TransitionCode>>;
}

export interface ClaimRequest {
  readonly provider: AccountingProvider;
  /**
   * The target modes the caller can serve. A pending document aimed at any other mode is left
   * alone, so a sender that can only rehearse never takes a document aimed at a test or the live
   * organisation, whatever the switch says.
   */
  readonly targetModes: readonly TargetMode[];
  /** Chosen by the caller (the domain reads no randomness); only its holder may complete the send. */
  readonly leaseToken: string;
  readonly leaseMs: number;
}

/**
 * Hand out the oldest pending document, locked and leased so two callers never get the same one.
 * A document is handed out only to the provider and mode it was created for (its recorded
 * `target`), and only while that provider is still in that mode: a Books claim in `test_org` or
 * `dry_run` never takes a document aimed at Xero live, and a flip of the switch never re-aims an
 * existing document. A document with no target, or whose provider is now `off`, is not handed out. A document whose lease ran
 * out is not handed out again: it becomes unknown and goes through lookup first. A document is not
 * handed out until what it waits for is issued for the same target (`documentsAwaited`: a
 * payment's invoices, an invoice's or credit note's contact); it waits, and the documents behind
 * it are handed out meanwhile.
 */
export interface IAccountingDocumentWorkQueue {
  claimNext(
    request: ClaimRequest,
  ): Promise<Result<StoredAccountingDocument | null, TransitionCode>>;
  /**
   * Does `leaseToken` still hold the document's lease, with at least `minRemainingMs` of it left?
   * Asked immediately before a provider write: false once the lease was swept (the document went
   * unknown), handed to someone else, or is about to run out.
   */
  holdsLease(documentId: string, leaseToken: string, minRemainingMs: number): Promise<boolean>;
  /**
   * Park, for a person, queued payments (aimed at `provider` in one of `targetModes`) applied to
   * an invoice that was cancelled in the same books: they could never be sent, so they go to
   * Needs a person (`invoice_cancelled`) instead of waiting for ever. Returns how many it parked.
   */
  parkStranded(request: StrandedRequest): Promise<number>;
}

export interface StrandedRequest {
  readonly provider: AccountingProvider;
  readonly targetModes: readonly TargetMode[];
  readonly limit: number;
}

export interface DueWorkRequest {
  readonly provider: AccountingProvider;
  readonly targetModes: readonly TargetMode[];
  /**
   * A failed document whose last error starts with one of these was refused for a passing reason
   * (a rate limit, the day's budget) and is retried; any other failure waits for a person.
   */
  readonly transientErrorPrefixes: readonly string[];
  readonly limit: number;
}

export interface DueWork {
  /**
   * Documents due for their next automatic step, oldest first: `unknown` ones whose first request
   * has settled and whose retry wait has passed (they are looked up), and `failed` ones refused for
   * a passing reason whose wait has passed (they are requeued). The wait grows with the attempts
   * made (`retryDelayMs`); a document that has used every attempt is due at once, for a person.
   */
  readonly documents: readonly StoredAccountingDocument[];
  /** Rows the domain would not read back; left untouched and reported, never acted on. */
  readonly unreadable: readonly string[];
}

/** What the sender does between sends: settle unknown outcomes and retry passing refusals. */
export interface IAccountingDocumentDueWork {
  listDue(request: DueWorkRequest): Promise<DueWork>;
}

export interface IAccountingSourceSettingReader {
  read(): Promise<Result<SwitchConfig, SwitchCode>>;
}

export interface SourceSettingChange {
  readonly product: Product;
  /** Only the modes given change. */
  readonly xero?: Mode;
  readonly books?: Mode;
  readonly updatedBy: string;
}

/** Staff change the switch here; the domain's rule (one live source per product) decides. */
export interface IAccountingSourceSettingWriter {
  update(change: SourceSettingChange): Promise<Result<SwitchConfig, SwitchCode | "not_found">>;
}

/** Facts for one flow: ready to project, or a plain reason this event gives the books nothing. */
export type FactsRead<T> =
  | { readonly status: "ready"; readonly facts: T }
  | { readonly status: "skip"; readonly reason: string };

/**
 * Reads what a Bid accounting flow needs from the stored rows (the events carry ids only). Money
 * comes back in whole pence, dates as London calendar days, ids lower case.
 */
export interface IBidAccountingFactsReader {
  invoiceRaised(invoiceId: string): Promise<FactsRead<BidInvoiceFacts>>;
  paymentCaptured(paymentId: string, capturedAt: Date): Promise<FactsRead<BidPaymentFacts>>;
  paymentRefunded(paymentId: string): Promise<FactsRead<BidRefundsFacts>>;
  /** A settled "Pay several" group: its stored total, members and courier quotes. */
  paymentGroupSettled(groupId: string): Promise<FactsRead<BidPaymentGroupFacts>>;
  /** The "Pay several" group a courier quote was charged in; null when it was not. */
  deliveryGroupOf(quoteId: string): Promise<string | null>;
}

export interface AccountingQueueQuery {
  readonly tab: QueueTab;
  /** One company's books, or both when null. */
  readonly legalEntity: LegalEntity | null;
  /** A single document by its exact LAX reference, within the tab and company; null for all. */
  readonly reference?: string | null;
  readonly limit: number;
  readonly offset: number;
}

/** The latest document that reached Books (or was rehearsed) for the company (or both). */
export interface AccountingLastSent {
  readonly at: Date;
  readonly rehearsal: boolean;
}

export interface AccountingQueuePage {
  /** The tab's documents under the filter, oldest change first (Issued: newest first). */
  readonly documents: readonly StoredAccountingDocument[];
  /** Rows the domain would not read back; counted in the totals, never shown as documents. */
  readonly unreadable: readonly string[];
  /** Documents in the chosen tab under the filter. */
  readonly total: number;
  /** Documents in each tab under the filter. */
  readonly counts: Readonly<Record<QueueTab, number>>;
  /** Documents issued to Books today (London), under the company filter. */
  readonly issuedToday: number;
  /** The latest issued document for the company filter, whatever the tab; null when there is none. */
  readonly lastSent: AccountingLastSent | null;
}

/** A bank transfer that has partly arrived; no Books document is made for it. */
export interface PartFundedTransfer {
  /** An invoice's own payment, or a "Pay several" group. */
  readonly source: "payment" | "payment_group";
  readonly id: string;
  /** The paying account's name. */
  readonly buyer: string;
  readonly receivedPence: number;
  readonly totalPence: number;
  /** When the provider last reported money arriving, where it is stored. */
  readonly since: Date | null;
}

/** Bank transfers part received, oldest first, for the Accounting page (read only). */
export interface IPartFundedTransfersReader {
  list(limit: number): Promise<readonly PartFundedTransfer[]>;
}

/**
 * What staff see of the queue (Finance › Accounting): one tab at a time, per company or both.
 * The tabs follow `queueTabFor` in the domain; cancelled documents are in none.
 */
export interface IAccountingDocumentBrowser {
  list(query: AccountingQueueQuery): Promise<AccountingQueuePage>;
  findById(id: string): Promise<Result<StoredAccountingDocument | null, StoredDocumentCode>>;
  /**
   * For each queued (`pending`) document, what it still waits for (`documentsAwaited`) that is not
   * issued for its target, by document id: the LAX reference and that document's state, or null
   * when nothing is registered under it there. Documents waiting for nothing are left out.
   */
  awaitedOf(
    documents: readonly StoredAccountingDocument[],
  ): Promise<ReadonlyMap<string, readonly AwaitedDocument[]>>;
}

/** A document another one waits for, and where it is. */
export interface AwaitedDocument {
  readonly reference: string;
  /** Its state for the waiting document's target; null when it is not registered there. */
  readonly state: DocumentRecord["status"] | null;
}

export interface QueueAge {
  readonly count: number;
  /** When the longest-waiting one last changed; null when there are none. */
  readonly oldestSince: Date | null;
}

export interface AccountingAttention {
  /** Documents a person must look at (the Needs a person tab). */
  readonly needsPerson: QueueAge;
  /**
   * Documents queued for Books, claimable and not yet claimed (`pending`, nothing awaited), by
   * target mode the sender serves. One waiting for another document is not the sender's to take.
   */
  readonly pending: QueueAge;
}

/** What the accounting watch checks: how long work has been waiting for a person or the sender. */
export interface IAccountingAttentionReader {
  read(pendingModes: readonly TargetMode[]): Promise<AccountingAttention>;
  /**
   * Bid invoices queued for Books in one of `modes` before `queuedBefore` that are still not
   * issued with LAX's copy stored (cancelled ones aside): the buyer sees "taking longer than usual".
   * `oldestSince` is when the oldest was queued.
   */
  delayedBidInvoices(modes: readonly TargetMode[], queuedBefore: Date): Promise<QueueAge>;
  /**
   * Payments queued for Books in one of `modes` since before `queuedBefore` that still wait for
   * an invoice (`documentsAwaited`): nobody sends them until that invoice is in Books.
   * `oldestSince` is when the oldest was queued.
   */
  waitingPayments(modes: readonly TargetMode[], queuedBefore: Date): Promise<QueueAge>;
}

/** LAX's stored copy of the PDF for an issued document. */
export interface AccountingDocumentCopy {
  readonly documentId: string;
  readonly storageKey: string;
  readonly byteSize: number;
  readonly sha256: string;
  /** Made by a dry run, not the provider: never emailed, never shown to a buyer as Books'. */
  readonly rehearsal: boolean;
  readonly storedAt: Date;
}

/** Issued documents without a stored copy; a row that cannot be read is named, not fatal. */
export interface UncopiedDocuments {
  readonly documents: readonly StoredAccountingDocument[];
  /** Ids of rows that did not read back as a document; the others are still listed. */
  readonly unreadable: readonly string[];
}

/** An issued Bid invoice whose stored copy is ready to email (never a rehearsal). */
export interface InvoiceEmailDue {
  readonly documentId: string;
  /** The Bid invoice the document was made from (its LAX reference's source id). */
  readonly invoiceId: string;
  /** The provider's invoice number. */
  readonly number: string;
  readonly storageKey: string;
}

/**
 * Why an invoice's email was settled without sending it; each is final.
 * - `invoice_missing`: the Bid invoice the document names no longer exists.
 * - `invoice_cancelled`: the invoice was cancelled before its email went.
 * - `no_recipient`: no current payer and no billing inbox to send it to.
 * - `unreadable_document`: the row does not read back as a numbered Bid invoice.
 */
export type InvoiceEmailSkipReason =
  | "invoice_missing"
  | "invoice_cancelled"
  | "no_recipient"
  | "unreadable_document";

/** The copies whose email is due, and the due rows that could not be read (settled as skipped). */
export interface InvoiceEmailDueList {
  readonly due: readonly InvoiceEmailDue[];
  /** Document ids listed as due whose row does not read back as a numbered Bid invoice. */
  readonly unreadable: readonly string[];
}

/**
 * The worker's side of the stored copies: which issued invoices have none yet, recording one,
 * and the "Your invoice" email settled once per copy (queued, or skipped for good).
 */
export interface IAccountingDocumentCopies {
  /** Issued Bid invoices aimed at one of `modes` that have no stored copy yet, newest first. */
  listUncopied(modes: readonly TargetMode[], limit: number): Promise<UncopiedDocuments>;
  /** Records a copy; false when the document already has one (another worker was first). */
  record(copy: AccountingDocumentCopy): Promise<boolean>;
  /**
   * Copies of Bid invoices Books issued live whose email is not settled yet, oldest first; never
   * a rehearsal, never a test organisation's invoice.
   */
  listEmailDue(limit: number): Promise<InvoiceEmailDueList>;
  /** Notes the email as queued; false when it was already settled (the note is made once). */
  markEmailQueued(documentId: string, outboxId: string, at: Date): Promise<boolean>;
  /**
   * Settles the email as never to be sent, so the copy leaves the due list; false when it was
   * already settled.
   */
  markEmailSkipped(documentId: string, reason: InvoiceEmailSkipReason, at: Date): Promise<boolean>;
}

/** What the "Your invoice" email says, read from the invoice's own rows. */
export interface BidInvoiceEmailFacts {
  readonly invoiceId: string;
  readonly lotId: string;
  readonly lotTitle: string;
  readonly totalPence: number;
  /** When the invoice's payment was captured, or null while it is owed. */
  readonly paidAt: Date | null;
  readonly dueAt: Date;
  readonly cancelled: boolean;
  /**
   * Who pays it, when they may still be told: the account holder for a personal purchase, or for
   * an organisation the member the latest payment names while they are still an active member
   * with a payer role (owner, admin or finance; the same rule as the download routes). A former
   * member, or one whose role no longer pays, is null.
   */
  readonly payer: { readonly userId: string; readonly email: string; readonly name: string } | null;
  /** The billing email the buyer account's finance team set, when there is one. */
  readonly billingEmail: string | null;
  readonly buyerLegalEntityId: string;
}

export interface IBidInvoiceEmailFactsReader {
  forInvoice(invoiceId: string): Promise<BidInvoiceEmailFacts | null>;
}

/** One Books document for a Bid invoice, as the buyer's invoice card reads it. */
export interface BidInvoiceBooksDocument {
  readonly documentId: string;
  readonly targetMode: TargetMode;
  readonly record: DocumentRecord;
  readonly grossPence: number;
  /**
   * When the document was issued: the `occurred_at` of its transition to `issued` in the event
   * log (never the row's `updated_at`, which later writes move). Null when not issued.
   */
  readonly issuedAt: Date | null;
  readonly copy: { readonly storageKey: string; readonly rehearsal: boolean } | null;
}

/** A Bid invoice and the Books documents made for it, for the buyer's invoice card. */
export interface BidInvoiceBooksState {
  readonly invoice: {
    readonly id: string;
    readonly raisedAt: Date;
    readonly voidedAt: Date | null;
    readonly totalPence: number;
  };
  /** The invoice document per target mode (at most one each). */
  readonly invoices: readonly BidInvoiceBooksDocument[];
}

/** Reads one Bid invoice's Books documents and their stored copies (the Bid API, read only). */
export interface IBidInvoiceBooksReader {
  read(invoiceId: string): Promise<Result<BidInvoiceBooksState | null, StoredDocumentCode>>;
}
