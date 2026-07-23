import "server-only";

import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import {
  type PayoutsListSearchParams,
  buildPayoutsListPageModel,
} from "@/lib/admin/build-payouts-list-page-model";
import { getAdminPayoutsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminPayoutsPage } from "@/lib/data/http/admin-payouts.reader";
import { EMPTY_ADMIN_PAYOUT_LIST_SUMMARY } from "@/lib/data/http/admin-payouts.shared";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import { PAYOUT_PROCESS_ACCESS, PAYOUT_REVERSE_ACCESS } from "@/lib/navigation/staff-nav-access";
import { type UserRole, userHasAccessTo } from "@auction/types";

export async function loadAdminPayoutsListPage(sp: PayoutsListSearchParams) {
  const model = buildPayoutsListPageModel(sp);
  const periodDays = parseAdminKpiPeriod(sp.period);

  const [sessionUser, payoutsTrend, navCounts] = await Promise.all([
    getServerSessionUser().catch(() => null),
    getAdminPayoutsKpiTrend(periodDays).catch(() => ({
      currentTotal: 0,
      priorTotal: 0,
      dailyCounts: [] as number[],
    })),
    getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS),
  ]);

  const role = (sessionUser?.role ?? "client") as UserRole;
  const staffRole = sessionUser?.staffRole ?? null;
  const capabilities = {
    canProcess: userHasAccessTo(role, staffRole, PAYOUT_PROCESS_ACCESS),
    canReverse: userHasAccessTo(role, staffRole, PAYOUT_REVERSE_ACCESS),
  };

  try {
    const page = await getAdminPayoutsPage(model.listQueryParams);
    const { summary } = page;
    const anomalies = detectAnomaliesFromNavCounts(navCounts, {
      clawbackPending: summary.clawbackPending,
      failedPayouts: summary.readiness.failedCount + summary.readiness.reversedCount,
    });

    return {
      model,
      periodDays,
      payoutsTrend,
      rows: page.rows,
      summary,
      total: page.total,
      hasNextPage: page.hasNextPage,
      loadError: null as string | null,
      anomalies,
      capabilities,
      pagination:
        page.total > 0 && (model.query.offset > 0 || page.hasNextPage)
          ? {
              offset: model.query.offset,
              limit: model.query.limit,
              countOnPage: page.rows.length,
              total: page.total,
              prevHref:
                model.query.offset > 0
                  ? model.buildPaginationHref({
                      offset: Math.max(0, model.query.offset - model.query.limit),
                    })
                  : null,
              nextHref: page.hasNextPage
                ? model.buildPaginationHref({
                    offset: model.query.offset + model.query.limit,
                  })
                : null,
            }
          : null,
    };
  } catch (error) {
    return {
      model,
      periodDays,
      payoutsTrend,
      rows: [],
      summary: EMPTY_ADMIN_PAYOUT_LIST_SUMMARY,
      total: 0,
      hasNextPage: false,
      loadError: error instanceof Error ? error.message : "Could not load payouts.",
      anomalies: [],
      capabilities,
      pagination: null,
    };
  }
}
