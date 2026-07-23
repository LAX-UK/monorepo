import "server-only";

import { parseAdminKpiPeriod } from "@/lib/admin/admin-kpi-period";
import { paymentsListController } from "@/lib/admin/admin-list-controllers";
import { detectAnomalies, detectAnomaliesFromNavCounts } from "@/lib/admin/anomaly-detection";
import {
  type PaymentsListSearchParams,
  buildPaymentsListPageModel,
} from "@/lib/admin/build-payments-list-page-model";
import { manualReviewListController } from "@/lib/admin/manual-review-list-controller";
import { getAdminPaymentsKpiTrend } from "@/lib/data/http/admin-kpi-trends.server";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminUsersByIds } from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import { type UserRole, canAccessPlatformAdminRoutes } from "@auction/types";

const EMPTY_PAYMENT_SUMMARY = { totalVolume: 0, captured: 0, pending: 0, refunded: 0 };
const EMPTY_MANUAL_SUMMARY = {
  total: 0,
  financeHolds: 0,
  complianceHolds: 0,
  amlHolds: 0,
  sofHolds: 0,
};

export async function loadAdminPaymentsListPage(sp: PaymentsListSearchParams) {
  const model = buildPaymentsListPageModel(sp);
  const periodDays = parseAdminKpiPeriod(sp.period);
  const paymentsTrendPromise = getAdminPaymentsKpiTrend(periodDays).catch(() => ({
    currentTotal: 0,
    priorTotal: 0,
    dailyCounts: [] as number[],
  }));

  if (model.manualReviewQueue) {
    const [manualResult, sessionUser, paymentsTrend] = await Promise.all([
      manualReviewListController.fetch(model.manualReviewQuery).then(
        (result) => ({ ...result, error: null as string | null }),
        (error) => ({
          rows: [] as Awaited<ReturnType<typeof manualReviewListController.fetch>>["rows"],
          allRows: [] as Awaited<ReturnType<typeof manualReviewListController.fetch>>["allRows"],
          summary: EMPTY_MANUAL_SUMMARY,
          error: error instanceof Error ? error.message : "Could not load manual review payments.",
        }),
      ),
      getServerSessionUser(),
      paymentsTrendPromise,
    ]);
    return {
      mode: "manual-review" as const,
      model,
      periodDays,
      paymentsTrend,
      rows: manualResult.rows,
      allRows: manualResult.allRows,
      summary: manualResult.summary,
      loadError: manualResult.error,
      canOpenComplianceQueues: sessionUser
        ? canAccessPlatformAdminRoutes(sessionUser.role as UserRole, sessionUser.staffRole ?? null)
        : false,
      anomalies: detectAnomalies(
        { manualReviewCount: manualResult.rows.length },
        { manualReviewCount: 0 },
      ),
    };
  }

  const [paymentResult, navCounts, paymentsTrend] = await Promise.all([
    paymentsListController.fetch(model.query).then(
      (result) => ({ ...result, error: null as string | null }),
      (error) => ({
        rows: [] as AdminPaymentTableRow[],
        paymentsSummary: EMPTY_PAYMENT_SUMMARY,
        total: 0,
        error: error instanceof Error ? error.message : "Could not load payments.",
      }),
    ),
    getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS),
    paymentsTrendPromise,
  ]);
  const buyerIds = [...new Set(paymentResult.rows.map((row) => row.buyerId).filter(Boolean))];
  const buyers = await getAdminUsersByIds(buyerIds).catch(() => []);
  const buyerLabels = new Map(buyers.map((buyer) => [buyer.id, buyer.name || buyer.email || null]));
  const rows = paymentResult.rows.map((row) => ({
    ...row,
    buyerLabel: row.buyerLabel ?? buyerLabels.get(row.buyerId) ?? null,
  }));
  const summary = paymentResult.paymentsSummary ?? EMPTY_PAYMENT_SUMMARY;
  const total = paymentResult.total ?? rows.length;

  return {
    mode: "payments" as const,
    model,
    periodDays,
    paymentsTrend,
    rows,
    summary,
    total,
    loadError: paymentResult.error,
    anomalies: detectAnomaliesFromNavCounts(navCounts, {
      awaitingCaptureVolume: summary.pending,
    }),
    pagination:
      !paymentResult.error && total > 0
        ? {
            offset: model.query.offset,
            limit: model.query.limit,
            countOnPage: rows.length,
            prevHref:
              model.query.offset > 0
                ? model.buildPaginationHref({
                    offset: Math.max(0, model.query.offset - model.query.limit),
                  })
                : null,
            nextHref:
              model.query.offset + rows.length < total
                ? model.buildPaginationHref({
                    offset: model.query.offset + model.query.limit,
                  })
                : null,
          }
        : null,
  };
}
