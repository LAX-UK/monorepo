import "server-only";

import type { PayoutsListSearch } from "@/lib/admin/finance/payouts-staff-list.vm";
import { payoutsListHref } from "@/lib/admin/finance/payouts-staff-list.vm";
import {
  getHeldSales,
  getOldRulePage,
  getPayoutSales,
} from "@/lib/data/http/admin-seller-proceeds.server";
import type { PayoutSalesDto } from "@/lib/data/http/admin-seller-proceeds.shared";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { SELLER_AGREEMENT_RECORD_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";
import { type HeldSaleRow, toHeldSaleRows } from "./held-sales.vm";
import {
  type OldRuleCsvKey,
  type OldRuleRow,
  buildOldRuleRow,
  oldRuleCsvRow,
} from "./old-rule-review.vm";

const LOAD_ERROR = "We could not reach the payouts service. Try again in a moment.";
const OLD_RULE_PAGE = 50;

/** A payout's sale lines for its record panel; called from the client. */
export async function loadPayoutSales(payoutId: string): Promise<PayoutSalesDto | null> {
  "use server";
  return getPayoutSales(payoutId);
}

export async function loadHeldSalesView(): Promise<{
  rows: HeldSaleRow[];
  loadError: string | null;
  canRecord: boolean;
}> {
  const user = await getServerSessionUser().catch(() => null);
  const canRecord =
    user !== null &&
    userHasAccessTo(user.role as UserRole, user.staffRoles, SELLER_AGREEMENT_RECORD_ACCESS);
  try {
    return { rows: toHeldSaleRows(await getHeldSales()), loadError: null, canRecord };
  } catch (error) {
    console.error("[loadHeldSalesView]", error);
    return { rows: [], loadError: LOAD_ERROR, canRecord };
  }
}

/** The most rows one export reads: well beyond the review's size, a guard against a runaway. */
export const OLD_RULE_EXPORT_MAX = 10_000;
const OLD_RULE_EXPORT_PAGE = 200;

/**
 * Every sale paid under the old rule as CSV rows, not just the page on screen: read page by page
 * through the API, which checks the person may read payouts. Called from the client.
 */
export async function exportOldRuleCsv(): Promise<Record<OldRuleCsvKey, string>[]> {
  "use server";
  const rows: Record<OldRuleCsvKey, string>[] = [];
  for (let offset = 0; offset < OLD_RULE_EXPORT_MAX; offset += OLD_RULE_EXPORT_PAGE) {
    const page = await getOldRulePage({ limit: OLD_RULE_EXPORT_PAGE, offset });
    rows.push(...page.data.map(oldRuleCsvRow));
    if (page.data.length < OLD_RULE_EXPORT_PAGE || rows.length >= page.meta.total) break;
  }
  return rows;
}

export async function loadOldRuleView(search: PayoutsListSearch): Promise<{
  rows: OldRuleRow[];
  total: number;
  loadError: string | null;
  pagination: { summary: string; prevHref: string | null; nextHref: string | null } | null;
}> {
  const raw = Number(typeof search.offset === "string" ? search.offset : 0);
  const offset = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
  try {
    const page = await getOldRulePage({ limit: OLD_RULE_PAGE, offset });
    const { total } = page.meta;
    const shown = page.data.length;
    return {
      rows: page.data.map((row) => buildOldRuleRow(row)),
      total,
      loadError: null,
      pagination:
        total > OLD_RULE_PAGE
          ? {
              summary: `${offset + 1}–${offset + shown} of ${total}`,
              prevHref:
                offset > 0
                  ? payoutsListHref(search, { offset: Math.max(0, offset - OLD_RULE_PAGE) })
                  : null,
              nextHref:
                offset + shown < total
                  ? payoutsListHref(search, { offset: offset + OLD_RULE_PAGE })
                  : null,
            }
          : null,
    };
  } catch (error) {
    console.error("[loadOldRuleView]", error);
    return { rows: [], total: 0, loadError: LOAD_ERROR, pagination: null };
  }
}
