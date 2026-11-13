import "server-only";

import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import {
  type AccountingSearch,
  type AccountingStaffRow,
  accountingHref,
  accountingRangeSummary,
  activeAccountingTab,
  activeOrganisation,
  activeReference,
  toAccountingStaffRows,
} from "@/lib/admin/finance/accounting-queue.vm";
import { getAccountingQueuePage } from "@/lib/data/http/admin-accounting.reader";
import { parseStaffPageSize } from "@auction/staff-ui";
import type { AccountingLastSent, AccountingQueueTab } from "@auction/types";
import { adminAccountingReferenceSchema } from "@auction/validators";

const EMPTY_COUNTS: Record<AccountingQueueTab, number> = {
  needs_person: 0,
  failed: 0,
  waiting: 0,
  issued: 0,
};

/** Shown in place of the rows; the raw HTTP failure stays in the server logs. */
const ACCOUNTING_LOAD_ERROR = "We could not reach the accounting service. Try again in a moment.";
const ACCOUNTING_FORBIDDEN = "You do not have access to accounting documents.";
/** Shown under the search box when what was typed is not a LAX reference. */
const ACCOUNTING_BAD_REFERENCE = "Enter a LAX reference, e.g. LAX-BID-INV-….";

function plainSearch(sp: AccountingSearch): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export type AdminAccountingPage = {
  search: Record<string, string>;
  tab: AccountingQueueTab;
  pageSize: number;
  filtered: boolean;
  rows: AccountingStaffRow[];
  counts: Record<AccountingQueueTab, number>;
  issuedToday: number;
  lastSent: AccountingLastSent | null;
  organisation: ReturnType<typeof activeOrganisation>;
  /** What is in the toolbar search box, as typed. */
  reference: string;
  /** The search box holds something that is not a LAX reference. */
  referenceError: string | null;
  canAct: boolean;
  rehearsal: boolean;
  unreadable: number;
  loadError: string | null;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
};

export async function loadAdminAccountingPage(sp: AccountingSearch): Promise<AdminAccountingPage> {
  const base = parseListSearchParams(sp);
  const limit = parseStaffPageSize(firstString(sp.limit));
  const search = plainSearch(sp);
  const tab = activeAccountingTab(search);
  const organisation = activeOrganisation(search);
  const typedReference = activeReference(search);
  // Only a well-formed reference reaches the API; anything else is a gentle error, not a 400.
  const parsedReference = typedReference
    ? adminAccountingReferenceSchema.safeParse(typedReference)
    : null;
  const reference = parsedReference?.success ? parsedReference.data : null;
  const referenceError =
    typedReference && !parsedReference?.success ? ACCOUNTING_BAD_REFERENCE : null;
  const shared = {
    search,
    tab,
    pageSize: limit,
    organisation,
    reference: typedReference,
    referenceError,
    filtered: organisation !== null || typedReference !== "",
  };

  // A reference that is not valid narrows to nothing without troubling the service.
  if (referenceError) {
    return {
      ...shared,
      rows: [],
      counts: EMPTY_COUNTS,
      issuedToday: 0,
      lastSent: null,
      canAct: false,
      rehearsal: false,
      unreadable: 0,
      loadError: null,
      pagination: null,
    };
  }

  try {
    const page = await getAccountingQueuePage({
      tab,
      organisation,
      reference,
      limit,
      offset: base.offset,
    });
    const rows = toAccountingStaffRows(page.rows);
    const total = Math.max(page.total, base.offset + rows.length);
    const shownTo = base.offset + rows.length;
    return {
      ...shared,
      rows,
      counts: page.counts,
      issuedToday: page.issuedToday,
      lastSent: page.lastSent,
      canAct: page.canAct,
      rehearsal: rows.some((row) => row.rehearsal),
      unreadable: page.unreadable,
      loadError: null,
      pagination:
        rows.length > 0
          ? {
              summary: accountingRangeSummary(base.offset, rows.length, total),
              prevHref:
                base.offset > 0
                  ? accountingHref(search, { offset: Math.max(0, base.offset - limit) })
                  : null,
              nextHref: shownTo < total ? accountingHref(search, { offset: shownTo }) : null,
            }
          : null,
    };
  } catch (error) {
    const forbidden = error instanceof Error && error.message === "forbidden";
    return {
      ...shared,
      rows: [],
      counts: EMPTY_COUNTS,
      issuedToday: 0,
      lastSent: null,
      canAct: false,
      rehearsal: false,
      unreadable: 0,
      loadError: forbidden ? ACCOUNTING_FORBIDDEN : ACCOUNTING_LOAD_ERROR,
      pagination: null,
    };
  }
}
