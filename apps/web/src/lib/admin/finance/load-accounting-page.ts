import "server-only";

import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import {
  type AccountingSearch,
  type AccountingStaffRow,
  accountingHref,
  accountingRangeSummary,
  activeAccountingTab,
  activeOrganisation,
  toAccountingStaffRows,
} from "@/lib/admin/finance/accounting-queue.vm";
import { getAccountingQueuePage } from "@/lib/data/http/admin-accounting.reader";
import { parseStaffPageSize } from "@auction/staff-ui";
import type { AccountingQueueTab } from "@auction/types";

const EMPTY_COUNTS: Record<AccountingQueueTab, number> = {
  needs_person: 0,
  failed: 0,
  waiting: 0,
  issued: 0,
};

/** Shown in place of the rows; the raw HTTP failure stays in the server logs. */
const ACCOUNTING_LOAD_ERROR = "We could not reach the accounting service. Try again in a moment.";
const ACCOUNTING_FORBIDDEN = "You do not have access to accounting documents.";

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
  const shared = { search, tab, pageSize: limit, filtered: organisation !== null };

  try {
    const page = await getAccountingQueuePage({ tab, organisation, limit, offset: base.offset });
    const rows = toAccountingStaffRows(page.rows);
    const total = Math.max(page.total, base.offset + rows.length);
    const shownTo = base.offset + rows.length;
    return {
      ...shared,
      rows,
      counts: page.counts,
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
      canAct: false,
      rehearsal: false,
      unreadable: 0,
      loadError: forbidden ? ACCOUNTING_FORBIDDEN : ACCOUNTING_LOAD_ERROR,
      pagination: null,
    };
  }
}
