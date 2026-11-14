/**
 * Finance › Accounting: the documents LAX sends to the books (Zoho Books), as staff see them. This
 * is the contract between the API and the Bid admin screen. The tabs follow the accounting
 * domain's `queueTabFor`; a document is tried again under the same LAX reference, never as a new
 * document.
 */

export const ACCOUNTING_QUEUE_TABS = ["needs_person", "failed", "waiting", "issued"] as const;
export type AccountingQueueTab = (typeof ACCOUNTING_QUEUE_TABS)[number];

export const ACCOUNTING_QUEUE_TAB_LABELS: Readonly<Record<AccountingQueueTab, string>> = {
  needs_person: "Needs a person",
  failed: "Failed",
  waiting: "Waiting",
  issued: "Issued",
};

export function isAccountingQueueTab(value: string): value is AccountingQueueTab {
  return (ACCOUNTING_QUEUE_TABS as readonly string[]).includes(value);
}

/** The two companies whose books LAX keeps. */
export const ACCOUNTING_ORGANISATIONS = ["london_auction_xchange", "london_art_exchange"] as const;
export type AccountingOrganisation = (typeof ACCOUNTING_ORGANISATIONS)[number];

export const ACCOUNTING_ORGANISATION_LABELS: Readonly<Record<AccountingOrganisation, string>> = {
  london_auction_xchange: "London Auction Xchange",
  london_art_exchange: "London Art Exchange",
};

export function isAccountingOrganisation(value: string): value is AccountingOrganisation {
  return (ACCOUNTING_ORGANISATIONS as readonly string[]).includes(value);
}

export const ACCOUNTING_DOCUMENT_TYPES = [
  "invoice",
  "payment",
  "credit_note",
  "bill",
  "contact",
] as const;
export type AccountingDocumentType = (typeof ACCOUNTING_DOCUMENT_TYPES)[number];

export const ACCOUNTING_DOCUMENT_TYPE_LABELS: Readonly<Record<AccountingDocumentType, string>> = {
  invoice: "Invoice",
  payment: "Payment",
  credit_note: "Credit note",
  bill: "Bill",
  contact: "Contact",
};

export const ACCOUNTING_PRODUCTS = ["bid", "shop", "lax_art"] as const;
export type AccountingProduct = (typeof ACCOUNTING_PRODUCTS)[number];

export const ACCOUNTING_PRODUCT_LABELS: Readonly<Record<AccountingProduct, string>> = {
  bid: "Bid",
  shop: "Shop",
  lax_art: "lax.art",
};

export type AccountingDocumentState =
  | "pending"
  | "sending"
  | "issued"
  | "unknown"
  | "needs_review"
  | "failed"
  | "cancelled";

/** How the document was sent: a rehearsal that reaches no books, the test books or the real ones. */
export type AccountingTargetMode = "dry_run" | "test_org" | "live";

/** Why a document is parked: kept here and never sent until the accountant or a person decides. */
export const ACCOUNTING_PARK_REASONS = [
  "vat_on_delivery",
  "invoice_cancelled",
  "vat_on_outside_uk_delivery",
] as const;
export type AccountingParkReason = (typeof ACCOUNTING_PARK_REASONS)[number];

/** One invoice a payment is applied to, and how much of the payment it takes. */
export type AccountingAppliedTo = { reference: string; amountPence: number };

/**
 * A document a queued one waits for (a payment's invoice, an invoice's contact) and its state in
 * the same books; null when nothing is registered under that reference there yet.
 */
export type AccountingWaitingFor = { reference: string; state: AccountingDocumentState | null };

/** One document on the page. */
export type AccountingQueueRow = {
  id: string;
  /** The LAX reference, e.g. LAX-BID-INV-01h…; the same for every try. */
  reference: string;
  documentType: AccountingDocumentType;
  /** What it is, in a few words: "Payment · Pay several", "Delivery · Pay several". */
  label: string;
  /** Kept here and never sent until this is settled; null when it goes to Books as usual. */
  parked: AccountingParkReason | null;
  /** A payment's invoices and what it applies to each, to the penny; empty for other documents. */
  appliedTo: AccountingAppliedTo[];
  /** For a queued document: what it still waits for before it can be sent; empty otherwise. */
  waitingFor: AccountingWaitingFor[];
  product: AccountingProduct;
  organisation: AccountingOrganisation;
  state: AccountingDocumentState;
  targetMode: AccountingTargetMode | null;
  /** The document's total in pence, VAT included. */
  grossPence: number;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  /** What went wrong, in plain English; null when nothing has. */
  problem: string | null;
  /** The provider's own code behind `problem`, for support; never shown on its own. */
  problemCode: string | null;
  /** Refused because its date is in a locked period: a person must confirm booking it today. */
  lockedPeriod: boolean;
  /** The Books document, once it exists there. `url` is null in a rehearsal or when unknown. */
  books: { number: string; id: string; url: string | null } | null;
  /** The person may try this document again now. */
  canTryAgain: boolean;
  /**
   * The person may ask to release this parked document (they hold the finance write permission).
   * Whether its reason is settled is checked when they ask, against the stored rows.
   */
  canRelease: boolean;
};

/**
 * A bank transfer that has partly arrived. It makes no Books document: the payment reaches Books
 * once the whole amount has arrived and been applied. Listed here so finance can reconcile it.
 */
export type AccountingPartFundedTransfer = {
  /** The LAX reference its payment will carry once it is booked. */
  reference: string;
  /** One transfer for several invoices ("Pay several"). */
  paySeveral: boolean;
  /** The paying account's name. */
  buyer: string;
  receivedPence: number;
  totalPence: number;
  /** When the provider last reported money arriving. */
  since: string | null;
};

/** The last document that reached Books (or, in a rehearsal, was rehearsed), for the header. */
export type AccountingLastSent = { at: string; rehearsal: boolean };

export type AccountingQueuePage = {
  tab: AccountingQueueTab;
  organisation: AccountingOrganisation | null;
  /** The LAX reference search in force, as validated; null when there is none. */
  reference: string | null;
  rows: AccountingQueueRow[];
  /** Documents in this tab under the filter. */
  total: number;
  counts: Record<AccountingQueueTab, number>;
  /** Documents that reached Books today (London), under the same filters. */
  issuedToday: number;
  /** The latest document issued for the company (or both), whatever the search; null for none. */
  lastSent: AccountingLastSent | null;
  limit: number;
  offset: number;
  /** Stored rows that could not be read back; they are counted but not listed. */
  unreadable: number;
  /** The person may try documents again (they hold the finance write permission). */
  canAct: boolean;
  /** Bank transfers that have only partly arrived (Bid), oldest first; no Books document yet. */
  partFundedTransfers: AccountingPartFundedTransfer[];
};

export type AccountingTryAgainOutcome = "requeued" | "already_queued";

export type AccountingTryAgainResult = {
  id: string;
  reference: string;
  outcome: AccountingTryAgainOutcome;
};

/** Why a try again was refused; the route words each one for staff. */
export type AccountingTryAgainRefusal = "not_found" | "not_allowed" | "unreadable";

export type AccountingReleaseOutcome = "released" | "already_queued";

export type AccountingReleaseResult = {
  id: string;
  reference: string;
  outcome: AccountingReleaseOutcome;
  /** The parked draft was replaced by the document rebuilt from the stored rows. */
  rebuilt: boolean;
};

/** Why a release was refused. `unresolved`: the reason it is parked is not settled yet. */
export type AccountingReleaseRefusal = "not_found" | "not_allowed" | "unreadable" | "unresolved";

/** What staff are told when a parked document cannot be released yet, by why it is parked. */
export const ACCOUNTING_RELEASE_UNRESOLVED_TEXT: Readonly<Record<AccountingParkReason, string>> = {
  vat_on_delivery:
    "The accountant has not yet confirmed how delivery is booked, so this stays out of Books.",
  invoice_cancelled:
    "The invoice this pays is still cancelled. Reinstate it in Bid first, or refund the buyer.",
  vat_on_outside_uk_delivery:
    "The accountant has not yet confirmed how outside-UK delivery is booked, so this stays out of Books.",
};

/** A payment applied to an invoice that was cancelled in Accounting cannot be sent. */
export const ACCOUNTING_RELEASE_INVOICE_CANCELLED_TEXT =
  "An invoice this pays was cancelled in Accounting, so it cannot be sent to Books. Refund the buyer.";

/** Rebuilt from what Bid holds now, the document is not the one that was parked. */
export const ACCOUNTING_RELEASE_CHANGED_TEXT =
  "This no longer matches what Bid holds for it. Ask engineering to look at it before it is released.";

const ACCOUNTING_PARKED_TEXT_VAT =
  "VAT on delivery. This stays out of Books until the accountant confirms how delivery is booked. Then press Release.";
const ACCOUNTING_PARKED_TEXT_CANCELLED =
  "The invoice this pays was cancelled after it was paid, so this is not sent to Books. Refund the buyer, or reinstate the invoice in Bid and press Release.";

const ACCOUNTING_PARKED_TEXT_OUTSIDE_UK =
  "Waiting for the accountant: VAT on outside-UK delivery. This stays out of Books until they confirm how it is booked. Then press Release.";

const KIND_NAME: Readonly<Record<string, string>> = {
  auth: "Books would not accept our sign-in",
  rate_limited: "Books asked us to slow down",
  budget_exhausted: "Today's Books call allowance is used up",
  server: "Books had a problem on its side",
  network: "Books could not be reached",
  unknown: "Books did not give a clear answer",
  not_found: "Books could not find something this document refers to",
  conflict: "Books holds a conflicting record",
};

/** Each refusal ends with the next step, so a row says what will happen and what a person can do. */
const KIND_NEXT_STEP: Readonly<Record<string, string>> = {
  auth: "Ask engineering to reconnect Books.",
  rate_limited: "We'll keep trying; you can also try now.",
  budget_exhausted: "It sends again once the allowance resets; you can also try now.",
  server: "We'll keep trying; you can also try now.",
  network: "We'll keep trying; you can also try now.",
  unknown: "Check Books for this reference, then try again.",
  not_found: "Check Books, then try again.",
  conflict: "Check Books for this reference, then try again.",
};

const CODE_TEXT: Readonly<Record<string, string>> = {
  zoho_books_organisation_not_configured: "This company's Books organisation is not set up yet.",
  zoho_books_entity_mismatch:
    "The document and what it refers to belong to different companies' books.",
  zoho_books_writes_disabled:
    "Sending to Books is switched off for this company, so this was only rehearsed.",
  zoho_books_mapping_vat_on_unregistered_entity:
    "A line carries VAT, but this company is not registered for VAT in Books.",
  zoho_books_mapping_no_tax_id: "A line carries VAT, but Books has no VAT rate set up for it.",
  zoho_books_mapping_vat_differs_from_books:
    "Books would work out a different VAT for a line than LAX did.",
  zoho_books_mapping_mixed_basis: "The lines mix prices with and without VAT.",
  zoho_books_mapping_unresolved_invoice: "A payment refers to an invoice that is not in Books yet.",
  zoho_books_contact_not_customer: "The contact in Books is not set up as a customer.",
  zoho_books_contact_not_vendor: "The contact in Books is not set up as a supplier.",
  zoho_books_contact_ambiguous: "More than one contact in Books carries this reference.",
  zoho_books_duplicate_ambiguous: "More than one document in Books carries this reference.",
  zoho_books_payment_mismatch:
    "Books already holds a payment under this reference that differs from ours.",
  zoho_books_reference_not_confirmed: "Books did not confirm the LAX reference on the document.",
  zoho_books_validation_invalid_request: "Books refused the document as it was sent.",
  zoho_books_validation_rejected_by_zoho: "Books refused the document as it was sent.",
  accounting_no_adapter_for_mode: "Nothing is set up to send documents for this mode.",
  accounting_parked_vat_on_delivery: ACCOUNTING_PARKED_TEXT_VAT,
  accounting_parked_invoice_cancelled: ACCOUNTING_PARKED_TEXT_CANCELLED,
  accounting_parked_vat_on_outside_uk_delivery: ACCOUNTING_PARKED_TEXT_OUTSIDE_UK,
};

/** What a person is told about a parked document, by why it is parked. */
export const ACCOUNTING_PARKED_TEXT: Readonly<Record<AccountingParkReason, string>> = {
  vat_on_delivery: ACCOUNTING_PARKED_TEXT_VAT,
  invoice_cancelled: ACCOUNTING_PARKED_TEXT_CANCELLED,
  vat_on_outside_uk_delivery: ACCOUNTING_PARKED_TEXT_OUTSIDE_UK,
};

/** The status a parked document shows instead of "Needs a person". */
export const ACCOUNTING_PARKED_STATUS: Readonly<Record<AccountingParkReason, string>> = {
  vat_on_delivery: "Waiting for the accountant",
  invoice_cancelled: "Needs a person",
  vat_on_outside_uk_delivery: "Waiting for the accountant",
};

/** Said of every payment in the details: the order the sender keeps. */
export const ACCOUNTING_PAYMENT_ORDER_TEXT = "Sent once each invoice it pays is in Books.";

/** Said of a queued invoice or credit note in the details: it follows its contact. */
export const ACCOUNTING_CONTACT_ORDER_TEXT = "Sent once its contact is in Books.";

/** The details' title over the order note for a document queued and not tried yet. */
export const ACCOUNTING_QUEUED_TITLE = "Not sent yet";

/** The part-funded bank transfers panel. */
export const ACCOUNTING_PART_FUNDED_TITLE = "Bank transfers part received";
export const ACCOUNTING_PART_FUNDED_TEXT =
  "Nothing goes to Books until the whole amount has arrived and been applied.";

/**
 * A row's few words: "Payment · Pay several" for one payment of several invoices, "Delivery
 * · Pay several" (a delivery invoice) for a courier quote paid with them, otherwise "Invoice · Bid". Read from
 * the LAX reference, which says where the document comes from.
 */
export function accountingDocumentLabel(
  documentType: AccountingDocumentType,
  product: AccountingProduct,
  reference: string,
): string {
  const sourceId = /^LAX-[A-Z]+-[A-Z]+-(.+)$/.exec(reference)?.[1] ?? "";
  if (documentType === "payment" && sourceId.startsWith("grp-")) return "Payment · Pay several";
  if (documentType === "invoice" && sourceId.startsWith("dlv-")) {
    return "Delivery · Pay several";
  }
  return `${ACCOUNTING_DOCUMENT_TYPE_LABELS[documentType]} · ${ACCOUNTING_PRODUCT_LABELS[product]}`;
}

/** The short "Last problem" line for a locked period, approved copy for the row. */
export const ACCOUNTING_LOCKED_PERIOD_PROBLEM =
  "This falls in a period your accountant has closed.";

/**
 * What staff read about a locked period in the list notice and the try-again dialog: the problem,
 * then the next step. Booking it on today's date is not yet built, so the step is to have the
 * accountant reopen the period in Books; trying again before that repeats the same refusal.
 */
export const ACCOUNTING_LOCKED_PERIOD_TEXT =
  "This falls in a period your accountant has closed in Books. Ask them to reopen it before you try again, or it will be refused the same way.";

/** The acknowledgement a person ticks before trying a locked-period document again. */
export const ACCOUNTING_LOCKED_PERIOD_ACKNOWLEDGEMENT =
  "I've asked the accountant to reopen the period in Books.";

/** Shown for a refused document that Books returned with no reason. */
export const ACCOUNTING_NO_REASON_TEXT = "Books gave no reason.";

const LOCKED_PERIOD_SUFFIX = "_period_locked";

function codeText(code: string): string {
  if (code.endsWith(LOCKED_PERIOD_SUFFIX)) return ACCOUNTING_LOCKED_PERIOD_PROBLEM;
  const known = CODE_TEXT[code];
  if (known) return known;
  const kind = Object.keys(KIND_NAME).find((k) => code.startsWith(`zoho_books_${k}_`));
  if (kind) return `${KIND_NAME[kind]}. ${KIND_NEXT_STEP[kind] ?? ""}`.trim();
  return "Books refused the document.";
}

/**
 * A stored reason in plain English. Reasons are fixed codes (`zoho_books_…`) or the life cycle's
 * own sentences ("refused 8 times: <code>", "provider total differs: grossPence by 1 pence");
 * each is turned into something staff can act on, and an unknown one is never shown raw.
 */
export function accountingProblemText(reason: string): string {
  const refused = /^refused (\d+) times: (.+)$/.exec(reason);
  if (refused?.[2]) return `Refused ${refused[1]} times. ${codeText(refused[2])}`;
  if (/^no answer after \d+ attempts/.test(reason)) {
    return "Books did not answer, several times. Check Books for this reference before anything else.";
  }
  const total = /^provider total differs: (netPence|vatPence|grossPence) by (-?\d+) pence$/.exec(
    reason,
  );
  if (total?.[1] && total[2]) {
    const field = { netPence: "net", vatPence: "VAT", grossPence: "gross" }[total[1]];
    return `Books worked out a ${field} total ${Math.abs(Number(total[2]))}p different from ours. ${TOTALS_MUST_MATCH}`;
  }
  const differs = /^provider document differs from ours: (.+)$/.exec(reason);
  if (differs?.[1]) {
    return `Books holds a document under this reference that differs from ours. ${codeText(differs[1])}`;
  }
  const many = /^(\d+) documents carry this reference$/.exec(reason);
  if (many) return `${many[1]} documents in Books carry this reference. Keep one, then look again.`;
  return codeText(reason);
}

/** What a person is told about a document whose totals Books worked out differently. */
const TOTALS_MUST_MATCH = "The totals must match before it can be issued.";

const POUNDS = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });

/**
 * A totals difference, with Books' own figure: "Books worked out £1,500.01. The totals must match
 * before it can be issued." `booksPence` is Books' figure for the field that differs (ours plus
 * the difference); a net or VAT figure says which it is.
 */
export function accountingTotalsMismatchText(
  field: "netPence" | "vatPence" | "grossPence",
  booksPence: number,
): string {
  const amount = POUNDS.format(booksPence / 100);
  const figure =
    field === "grossPence" ? amount : `${amount} ${field === "netPence" ? "net" : "VAT"}`;
  return `Books worked out ${figure}. ${TOTALS_MUST_MATCH}`;
}

/** The provider code inside a stored reason, if there is one (for support). */
export function accountingProblemCode(reason: string): string | null {
  const code = /(zoho_books_[a-z0-9_]+|fake_[a-z0-9_]+|accounting_[a-z0-9_]+)/.exec(reason);
  return code?.[1] ?? null;
}
