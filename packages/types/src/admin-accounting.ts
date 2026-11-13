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

/** One document on the page. */
export type AccountingQueueRow = {
  id: string;
  /** The LAX reference, e.g. LAX-BID-INV-01h…; the same for every try. */
  reference: string;
  documentType: AccountingDocumentType;
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
};

export type AccountingTryAgainOutcome = "requeued" | "already_queued";

export type AccountingTryAgainResult = {
  id: string;
  reference: string;
  outcome: AccountingTryAgainOutcome;
};

/** Why a try again was refused; the route words each one for staff. */
export type AccountingTryAgainRefusal = "not_found" | "not_allowed" | "unreadable";

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
};

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
    return `Books worked out a ${field} total ${Math.abs(Number(total[2]))}p different from ours. It is in Books; check it there.`;
  }
  const differs = /^provider document differs from ours: (.+)$/.exec(reason);
  if (differs?.[1]) {
    return `Books holds a document under this reference that differs from ours. ${codeText(differs[1])}`;
  }
  const many = /^(\d+) documents carry this reference$/.exec(reason);
  if (many) return `${many[1]} documents in Books carry this reference. Keep one, then look again.`;
  return codeText(reason);
}

/** The provider code inside a stored reason, if there is one (for support). */
export function accountingProblemCode(reason: string): string | null {
  const code = /(zoho_books_[a-z0-9_]+|fake_[a-z0-9_]+|accounting_[a-z0-9_]+)/.exec(reason);
  return code?.[1] ?? null;
}
