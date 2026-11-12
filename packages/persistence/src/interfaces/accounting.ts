import type {
  AccountingDocument,
  DocumentKind,
  DocumentRecord,
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

/** Add a document to the queue. Idempotent per reference. */
export interface IAccountingDocumentRegistry {
  register(input: RegisterInput): Promise<Result<RegisterOutcome, RegisterCode>>;
}

/** Look a document up by its LAX reference (the product says which legal entity's books). */
export interface IAccountingDocumentLookup {
  findByReference(
    product: Product,
    reference: string,
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
  | { readonly action: "requeue" }
  | { readonly action: "cancel" };

/**
 * Move a document along its life cycle. The pure domain function decides; the new state and its
 * history row are written together or not at all. Anything the domain refuses is returned as its
 * refusal and nothing is written.
 */
export interface IAccountingDocumentTransitions {
  apply(
    documentId: string,
    transition: DocumentTransition,
  ): Promise<Result<StoredAccountingDocument, TransitionCode>>;
}

export interface ClaimRequest {
  readonly provider: AccountingProvider;
  /** Chosen by the caller (the domain reads no randomness); only its holder may complete the send. */
  readonly leaseToken: string;
  readonly leaseMs: number;
}

/**
 * Hand out the oldest pending document, locked and leased so two callers never get the same one.
 * A document whose lease ran out is not handed out again: it becomes unknown and goes through
 * lookup first.
 */
export interface IAccountingDocumentWorkQueue {
  claimNext(
    request: ClaimRequest,
  ): Promise<Result<StoredAccountingDocument | null, TransitionCode>>;
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
