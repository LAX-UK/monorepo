import { buildListHref } from "@/lib/admin/admin-list-params";
import { legalEntityFor } from "@auction/branding";
import {
  type DataView as StaffDataView,
  type StatusPresentation,
  formatStaffDateTime,
  formatStaffMoney,
} from "@auction/staff-ui";
import {
  ACCOUNTING_CONTACT_ORDER_TEXT,
  ACCOUNTING_DOCUMENT_TYPE_LABELS,
  ACCOUNTING_LOCKED_PERIOD_TEXT,
  ACCOUNTING_PARKED_STATUS,
  ACCOUNTING_PAYMENT_ORDER_TEXT,
  ACCOUNTING_QUEUE_TABS,
  ACCOUNTING_QUEUE_TAB_LABELS,
  type AccountingDocumentState,
  type AccountingOrganisation,
  type AccountingParkReason,
  type AccountingPartFundedTransfer,
  type AccountingQueueRow,
  type AccountingQueueTab,
  type AccountingReleaseOutcome,
  type AccountingTryAgainOutcome,
  type AccountingUnattributedRefund,
  isAccountingOrganisation,
  isAccountingQueueTab,
} from "@auction/types";

/** Which company runs the accounting for each organisation, so its filed name can be read. */
const ORGANISATION_PRODUCT: Readonly<Record<AccountingOrganisation, "bid" | "shop">> = {
  london_auction_xchange: "bid",
  london_art_exchange: "shop",
};

/** The company's registered name, with its legal suffix ("London Auction Xchange LTD"). */
export function legalNameForOrganisation(organisation: AccountingOrganisation): string {
  return legalEntityFor(ORGANISATION_PRODUCT[organisation]).name;
}

/** The company names the current filter covers, joined for the header: one company, or both. */
export function legalNamesForFilter(organisation: AccountingOrganisation | null): string {
  if (organisation) return legalNameForOrganisation(organisation);
  return `${legalNameForOrganisation("london_auction_xchange")} and ${legalNameForOrganisation("london_art_exchange")}`;
}

export const ACCOUNTING_PATH = "/admin/finance/accounting";

export type AccountingSearch = Record<string, string | string[] | undefined>;

/** Where a person lands: the documents waiting for them. */
export const DEFAULT_ACCOUNTING_TAB: AccountingQueueTab = "needs_person";

function first(value: string | string[] | undefined): string {
  return typeof value === "string" ? value : "";
}

export function activeAccountingTab(search: AccountingSearch): AccountingQueueTab {
  const tab = first(search.tab);
  return isAccountingQueueTab(tab) ? tab : DEFAULT_ACCOUNTING_TAB;
}

/** One company's books, or null for both. */
export function activeOrganisation(search: AccountingSearch): AccountingOrganisation | null {
  const organisation = first(search.organisation);
  return isAccountingOrganisation(organisation) ? organisation : null;
}

/** A reference typed into the toolbar search, trimmed; empty when there is none. */
export function activeReference(search: AccountingSearch): string {
  return first(search.reference).trim();
}

/** The three-way organisation filter as a segmented control: both companies, or one. */
export const ORGANISATION_SEGMENTS: readonly { value: string; label: string }[] = [
  { value: "", label: "Both" },
  { value: "london_auction_xchange", label: "Auction Xchange" },
  { value: "london_art_exchange", label: "Art Exchange" },
];

/** A link to the page with some of its URL state changed; paging restarts unless it is changed. */
export function accountingHref(
  search: AccountingSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: AccountingSearch = { ...search };
  for (const key of ["error", "success"]) delete base[key];
  return buildListHref(ACCOUNTING_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

/** The tabs a person works through, each with its count while it has work in it. */
const COUNTED_TABS: readonly AccountingQueueTab[] = ["needs_person", "failed", "waiting"];

/** The Issued tab's label: its count is the documents that reached Books today (London). */
export const ISSUED_TODAY_TAB_LABEL = "Issued today";

/**
 * The queue tabs. The waiting tabs carry the count waiting; Issued today carries how many reached Books
 * today (London), so staff see the day's progress rather than the lifetime total.
 */
export function accountingTabs(
  search: AccountingSearch,
  counts: Record<AccountingQueueTab, number>,
  issuedToday: number,
): StaffDataView[] {
  return ACCOUNTING_QUEUE_TABS.map((tab) => {
    const count = tab === "issued" ? issuedToday : counts[tab];
    const shows =
      tab === "issued" ? issuedToday > 0 : COUNTED_TABS.includes(tab) && counts[tab] > 0;
    return {
      id: tab,
      // The Issued count is how many reached Books today, so the label says so.
      label: tab === "issued" ? ISSUED_TODAY_TAB_LABEL : ACCOUNTING_QUEUE_TAB_LABELS[tab],
      href: accountingHref(search, { tab: tab === DEFAULT_ACCOUNTING_TAB ? null : tab }),
      ...(shows ? { count } : {}),
    };
  });
}

const STATE_PRESENTATION: Readonly<Record<AccountingDocumentState, StatusPresentation>> = {
  pending: { label: "Queued", tone: "neutral" },
  sending: { label: "Sending", tone: "info" },
  unknown: { label: "Checking Books", tone: "info" },
  needs_review: { label: "Needs a person", tone: "warning" },
  // One word, matching the Failed tab and the Failed jobs source.
  failed: { label: "Failed", tone: "danger" },
  issued: { label: "In Books", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function accountingStatePresentation(
  row: Pick<AccountingQueueRow, "state" | "lockedPeriod" | "targetMode"> & {
    parked?: AccountingParkReason | null;
  },
): StatusPresentation {
  if (row.lockedPeriod) return { label: "Locked period", tone: "warning" };
  if (row.state === "needs_review" && row.parked) {
    return { label: ACCOUNTING_PARKED_STATUS[row.parked], tone: "warning" };
  }
  if (row.state === "issued" && row.targetMode === "dry_run") {
    return { label: "Rehearsed", tone: "neutral" };
  }
  return STATE_PRESENTATION[row.state];
}

/** What the Books column says: the document there, a rehearsal, or nothing yet. */
export type AccountingBooksCell =
  | { kind: "link"; label: string; href: string }
  | { kind: "text"; label: string }
  | { kind: "none" };

export function accountingBooksCell(
  row: Pick<AccountingQueueRow, "books" | "targetMode">,
): AccountingBooksCell {
  if (!row.books) return { kind: "none" };
  if (row.targetMode === "dry_run") return { kind: "text", label: "Rehearsal, not in Books" };
  // Only the Books number staff would quote, never the internal provider id.
  const label = row.books.number;
  return row.books.url ? { kind: "link", label, href: row.books.url } : { kind: "text", label };
}

/** One document as the list shows it; plain data, so it crosses to the client as is. */
export type AccountingStaffRow = {
  id: string;
  reference: string;
  /** "Invoice · Bid" under the reference. */
  kind: string;
  documentType: string;
  company: string;
  amount: string;
  grossPence: number;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  state: StatusPresentation;
  problem: string | null;
  books: AccountingBooksCell;
  lockedPeriod: boolean;
  rehearsal: boolean;
  canTryAgain: boolean;
  /** The person may ask to release this parked document; the API checks its reason is settled. */
  canRelease: boolean;
  /** Kept out of Books until the accountant or a person decides; released, never tried again. */
  parked: AccountingParkReason | null;
  /** A payment's invoices, each with what it takes ("£120.00"); empty for other documents. */
  appliedTo: { reference: string; amount: string }[];
  /**
   * What a queued document still waits for, each with where it is ("Failed", "Not queued yet"),
   * so a waiting payment names the invoice holding it; empty otherwise.
   */
  waitingFor: { reference: string; state: string }[];
  /** The order it is sent in: a payment after its invoices, an invoice after its contact. */
  note: string | null;
  /** Queued and never tried: nothing has been asked of Books yet, so there is no problem to show. */
  untried: boolean;
};

/** What each kind of document waits for before it is sent (`documentsAwaited` in the domain). */
const ORDER_NOTE: Partial<Record<AccountingQueueRow["documentType"], string>> = {
  payment: ACCOUNTING_PAYMENT_ORDER_TEXT,
  invoice: ACCOUNTING_CONTACT_ORDER_TEXT,
  credit_note: ACCOUNTING_CONTACT_ORDER_TEXT,
};

export function toAccountingStaffRows(rows: readonly AccountingQueueRow[]): AccountingStaffRow[] {
  return rows.map((row) => {
    const documentType = ACCOUNTING_DOCUMENT_TYPE_LABELS[row.documentType];
    return {
      id: row.id,
      reference: row.reference,
      kind: row.label,
      documentType,
      company: legalNameForOrganisation(row.organisation),
      amount: formatStaffMoney(row.grossPence, "GBP"),
      grossPence: row.grossPence,
      attempts: row.attempts,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      state: accountingStatePresentation(row),
      problem: row.problem,
      books: accountingBooksCell(row),
      lockedPeriod: row.lockedPeriod,
      rehearsal: row.targetMode === "dry_run",
      canTryAgain: row.canTryAgain,
      canRelease: row.canRelease,
      parked: row.parked,
      appliedTo: row.appliedTo.map((applied) => ({
        reference: applied.reference,
        amount: formatStaffMoney(applied.amountPence, "GBP"),
      })),
      waitingFor: row.waitingFor.map((awaited) => ({
        reference: awaited.reference,
        state: awaited.state === null ? NOT_QUEUED_LABEL : STATE_PRESENTATION[awaited.state].label,
      })),
      note: row.parked === null ? (ORDER_NOTE[row.documentType] ?? null) : null,
      untried: row.state === "pending" && row.attempts === 0,
    };
  });
}

/** Said of a document another waits for when nothing is registered under its reference yet. */
export const NOT_QUEUED_LABEL = "Not queued yet";

/** The row's one line about what holds a waiting document: "Waiting for LAX-BID-INV-1 · Failed". */
export function waitingForLine(row: Pick<AccountingStaffRow, "waitingFor">): string | null {
  const [first, ...rest] = row.waitingFor;
  if (!first) return null;
  const more = rest.length === 0 ? "" : ` and ${rest.length} more`;
  return `Waiting for ${first.reference} · ${first.state}${more}`;
}

/** One bank transfer part received, as the panel lists it. */
export type AccountingPartFundedRow = {
  reference: string;
  /** "Pay several" or "Bank transfer". */
  kind: string;
  buyer: string;
  /** "£1,000.01 of £2,500.00 received". */
  received: string;
  since: string | null;
};

export function toPartFundedRows(
  transfers: readonly AccountingPartFundedTransfer[],
): AccountingPartFundedRow[] {
  return transfers.map((t) => ({
    reference: t.reference,
    kind: t.paySeveral ? "Pay several" : "Bank transfer",
    buyer: t.buyer,
    received: `${formatStaffMoney(t.receivedPence, "GBP")} of ${formatStaffMoney(t.totalPence, "GBP")} received`,
    since: t.since,
  }));
}

/** One "Pay several" group's refunds waiting to be assigned, as the panel lists it. */
export type AccountingUnattributedRow = {
  paymentGroupId: string;
  buyer: string;
  /** "£12.34 not matched". */
  amount: string;
};

export function toUnattributedRows(
  refunds: readonly AccountingUnattributedRefund[],
): AccountingUnattributedRow[] {
  return refunds.map((r) => ({
    paymentGroupId: r.paymentGroupId,
    buyer: r.buyerName,
    amount: `${formatStaffMoney(r.amountPence, "GBP")} not matched`,
  }));
}

/** The confirm dialog for trying a document again: the same document, the same reference. */
export function tryAgainCopy(row: Pick<AccountingStaffRow, "reference" | "lockedPeriod">): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  const same = `It is sent again as the same document, under the same LAX reference ${row.reference}. No new document is made.`;
  return {
    title: `Try ${row.reference} again?`,
    description: row.lockedPeriod ? `${ACCOUNTING_LOCKED_PERIOD_TEXT} ${same}` : same,
    confirmLabel: "Try again",
  };
}

/**
 * The confirm dialog for releasing a parked document: it is checked against what Bid holds now and
 * queued under the same reference, or refused with the reason if that is not settled yet.
 */
export function releaseCopy(row: Pick<AccountingStaffRow, "reference">): {
  title: string;
  description: string;
  confirmLabel: string;
} {
  return {
    title: `Release ${row.reference}?`,
    description: `Release it once the reason it is parked is settled. It is checked against what Bid holds now and queued for Books under the same LAX reference ${row.reference}. If the reason is not settled, nothing changes.`,
    confirmLabel: "Release",
  };
}

/** What the person is told once a release is in. */
export function releaseToast(outcome: AccountingReleaseOutcome, reference: string): string {
  return outcome === "released"
    ? `${reference} is released and queued for Books`
    : `${reference} was already queued`;
}

/** The two halves of the phone-only row meta: "Tried 3 times" and "last Wed 11 Nov, 09:30 GMT". */
export function rowMetaParts(
  row: Pick<AccountingStaffRow, "attempts" | "updatedAt">,
): readonly [tries: string, last: string] {
  const tries = row.attempts === 1 ? "Tried once" : `Tried ${row.attempts} times`;
  return [tries, `last ${formatStaffDateTime(row.updatedAt)}`];
}

/** The phone-only row meta: "Tried 3 times · last Wed 11 Nov, 09:30 GMT". */
export function rowMetaLine(row: Pick<AccountingStaffRow, "attempts" | "updatedAt">): string {
  return rowMetaParts(row).join(" · ");
}

/** The heading over the locked-period explanation on the list. */
export function lockedPeriodTitle(count: number): string {
  return count === 1
    ? "1 document is dated in a locked period"
    : `${count} documents are dated in a locked period`;
}

/** What the person is told once the request is in. */
export function tryAgainToast(outcome: AccountingTryAgainOutcome, reference: string): string {
  return outcome === "requeued"
    ? `${reference} is queued to send again`
    : `${reference} was already queued`;
}

/** What an empty tab says, so a quiet queue reads as good news and not as a fault. */
export const ACCOUNTING_EMPTY_COPY: Readonly<
  Record<AccountingQueueTab, { title: string; description: string }>
> = {
  needs_person: {
    title: "Nothing needs a person",
    description:
      "Documents Books could not take on its own, or that need someone to check Books first, wait here.",
  },
  failed: {
    title: "Nothing was refused",
    description: "Documents Books refuses appear here with the reason, ready to try again.",
  },
  waiting: {
    title: "Nothing is waiting",
    description: "Documents queued for Books, or being checked there, appear here until they land.",
  },
  issued: {
    title: "Nothing is in Books yet",
    description: "Documents Books has accepted appear here with their Books number.",
  },
};

/** "1–50 of 312 documents". */
export function accountingRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "document" : "documents";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}

export const ACCOUNTING_DESCRIPTION =
  "Invoices, payments, credit notes and bills sent to Zoho Books for both companies.";

/** Shown while Books is rehearsing: nothing on the page has reached a real Books organisation. */
export const ACCOUNTING_REHEARSAL_NOTICE =
  "Books is in rehearsal. Documents are prepared exactly as they would be sent, but nothing reaches a Books organisation.";
