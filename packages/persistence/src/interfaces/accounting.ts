import type {
  AccountingDocument,
  BidInvoiceFacts,
  BidPaymentFacts,
  BidRefundsFacts,
  DocumentKind,
  DocumentRecord,
  DocumentTarget,
  IssueOutcome,
  LegalEntity,
  LifecycleCode,
  LookupOutcome,
  Mode,
  Product,
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
  | { readonly action: "requeue" }
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
 * out is not handed out again: it becomes unknown and goes through lookup first.
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
}
