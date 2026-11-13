import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  type FilterOption,
  type DataView as StaffDataView,
  type StatusPresentation,
  formatStaffMoney,
} from "@auction/staff-ui";
import {
  ACCOUNTING_DOCUMENT_TYPE_LABELS,
  ACCOUNTING_LOCKED_PERIOD_TEXT,
  ACCOUNTING_ORGANISATIONS,
  ACCOUNTING_ORGANISATION_LABELS,
  ACCOUNTING_PRODUCT_LABELS,
  ACCOUNTING_QUEUE_TABS,
  ACCOUNTING_QUEUE_TAB_LABELS,
  type AccountingDocumentState,
  type AccountingOrganisation,
  type AccountingQueueRow,
  type AccountingQueueTab,
  type AccountingTryAgainOutcome,
  isAccountingOrganisation,
  isAccountingQueueTab,
} from "@auction/types";

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

export function accountingTabs(
  search: AccountingSearch,
  counts: Record<AccountingQueueTab, number>,
): StaffDataView[] {
  return ACCOUNTING_QUEUE_TABS.map((tab) => ({
    id: tab,
    label: ACCOUNTING_QUEUE_TAB_LABELS[tab],
    href: accountingHref(search, { tab: tab === DEFAULT_ACCOUNTING_TAB ? null : tab }),
    ...(COUNTED_TABS.includes(tab) && counts[tab] > 0 ? { count: counts[tab] } : {}),
  }));
}

export const ORGANISATION_FILTERS: readonly FilterOption[] = ACCOUNTING_ORGANISATIONS.map(
  (value) => ({ value, label: ACCOUNTING_ORGANISATION_LABELS[value] }),
);

export type AccountingFilterChip = { id: string; label: string; clearHref: string };

export function accountingFilterChips(search: AccountingSearch): AccountingFilterChip[] {
  const organisation = activeOrganisation(search);
  if (!organisation) return [];
  return [
    {
      id: "organisation",
      label: `Company: ${ACCOUNTING_ORGANISATION_LABELS[organisation]}`,
      clearHref: accountingHref(search, { organisation: null }),
    },
  ];
}

const STATE_PRESENTATION: Readonly<Record<AccountingDocumentState, StatusPresentation>> = {
  pending: { label: "Queued", tone: "neutral" },
  sending: { label: "Sending", tone: "info" },
  unknown: { label: "Checking Books", tone: "info" },
  needs_review: { label: "Needs a person", tone: "warning" },
  failed: { label: "Refused", tone: "danger" },
  issued: { label: "In Books", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function accountingStatePresentation(
  row: Pick<AccountingQueueRow, "state" | "lockedPeriod" | "targetMode">,
): StatusPresentation {
  if (row.lockedPeriod) return { label: "Locked period", tone: "warning" };
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
  const label = `${row.books.number} · ${row.books.id}`;
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
};

export function toAccountingStaffRows(rows: readonly AccountingQueueRow[]): AccountingStaffRow[] {
  return rows.map((row) => {
    const documentType = ACCOUNTING_DOCUMENT_TYPE_LABELS[row.documentType];
    return {
      id: row.id,
      reference: row.reference,
      kind: `${documentType} · ${ACCOUNTING_PRODUCT_LABELS[row.product]}`,
      documentType,
      company: ACCOUNTING_ORGANISATION_LABELS[row.organisation],
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
    };
  });
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
    description: row.lockedPeriod
      ? `${ACCOUNTING_LOCKED_PERIOD_TEXT} Only try again once that is confirmed. ${same}`
      : same,
    confirmLabel: "Try again",
  };
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
