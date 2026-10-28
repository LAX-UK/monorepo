import "server-only";

import { paymentsListController } from "@/lib/admin/admin-list-controllers";
import {
  type PaymentsListSearchParams,
  buildPaymentsListPageModel,
} from "@/lib/admin/build-payments-list-page-model";
import { paymentLinkAccess } from "@/lib/admin/finance/payment-link-access";
import {
  type PaymentsListSearch,
  activePaymentsView,
  paymentsListHref,
  paymentsRangeSummary,
  toManualReviewStaffRows,
  toPaymentsStaffRows,
} from "@/lib/admin/finance/payments-staff-list.vm";
import { manualReviewListController } from "@/lib/admin/manual-review-list-controller";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminUsersByIds } from "@/lib/data/http/admin.server";
import { getServerSessionUser } from "@/lib/data/http/session.server";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import {
  PAYMENT_MANUAL_REVIEW_WRITE_ACCESS,
  PAYMENT_WRITE_ACCESS,
  type UserRole,
  canAccessPlatformAdminRoutes,
  userHasAccessTo,
} from "@auction/types";

const EMPTY_PAYMENT_SUMMARY = { totalVolume: 0, captured: 0, pending: 0, refunded: 0 };
const EMPTY_MANUAL_SUMMARY = {
  total: 0,
  financeHolds: 0,
  complianceHolds: 0,
  amlHolds: 0,
  sofHolds: 0,
};

/** Shown in place of the rows; the raw HTTP failure stays in the server logs. */
const PAYMENTS_LOAD_ERROR = "We could not reach the payments service. Try again in a moment.";
const MANUAL_REVIEW_LOAD_ERROR =
  "We could not load the manual review queue. Try again in a moment.";

type SessionUser = Awaited<ReturnType<typeof getServerSessionUser>>;

/** What the signed-in staff member may do to a payment and open from it, from the rules the API enforces. */
function paymentActionCapabilities(sessionUser: SessionUser) {
  const role = (sessionUser?.role ?? "client") as UserRole;
  const staffRoles = sessionUser?.staffRoles;
  return {
    canWritePayments: userHasAccessTo(role, staffRoles, PAYMENT_WRITE_ACCESS),
    canResolveManualReview: userHasAccessTo(role, staffRoles, PAYMENT_MANUAL_REVIEW_WRITE_ACCESS),
    ...paymentLinkAccess(role, staffRoles),
  };
}

/** The search params as plain strings, so the client can build view and filter links. */
function plainSearch(sp: PaymentsListSearchParams): PaymentsListSearch {
  return Object.fromEntries(
    Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  );
}

export async function loadAdminPaymentsListPage(sp: PaymentsListSearchParams) {
  const model = buildPaymentsListPageModel(sp);
  const search = plainSearch(sp);
  const view = activePaymentsView(search);
  const navCountsPromise = getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);

  if (model.manualReviewQueue) {
    const [manualResult, sessionUser, navCounts] = await Promise.all([
      manualReviewListController.fetch(model.manualReviewQuery).then(
        (result) => ({ ...result, error: null as string | null }),
        () => ({
          rows: [] as Awaited<ReturnType<typeof manualReviewListController.fetch>>["rows"],
          allRows: [] as Awaited<ReturnType<typeof manualReviewListController.fetch>>["allRows"],
          summary: EMPTY_MANUAL_SUMMARY,
          error: MANUAL_REVIEW_LOAD_ERROR as string | null,
        }),
      ),
      getServerSessionUser(),
      navCountsPromise,
    ]);
    return {
      mode: "manual-review" as const,
      search,
      view,
      reasonFilter: model.manualReviewReasonFilter,
      rows: toManualReviewStaffRows(manualResult.rows),
      queueSize: manualResult.allRows.length,
      summary: manualResult.summary,
      loadError: manualResult.error,
      ...paymentActionCapabilities(sessionUser),
      canOpenComplianceQueues: sessionUser
        ? canAccessPlatformAdminRoutes(sessionUser.role as UserRole, sessionUser.staffRoles)
        : false,
      attentionCounts: {
        manualReviewCount: manualResult.allRows.length,
        disputesOpen: navCounts.disputesOpen,
      },
    };
  }

  const [paymentResult, navCounts, sessionUser] = await Promise.all([
    paymentsListController.fetch(model.query).then(
      (result) => ({ ...result, error: null as string | null }),
      () => ({
        rows: [] as AdminPaymentTableRow[],
        paymentsSummary: EMPTY_PAYMENT_SUMMARY,
        total: 0,
        error: PAYMENTS_LOAD_ERROR as string | null,
      }),
    ),
    navCountsPromise,
    getServerSessionUser(),
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
  const { offset, limit } = model.query;

  return {
    mode: "payments" as const,
    search,
    view,
    rows: toPaymentsStaffRows(rows),
    summary,
    total,
    loadError: paymentResult.error,
    ...paymentActionCapabilities(sessionUser),
    attentionCounts: {
      manualReviewCount: navCounts.manualReviewCount,
      disputesOpen: navCounts.disputesOpen,
    },
    exportFilters: model.exportFilters,
    pageSize: limit,
    pagination:
      !paymentResult.error && rows.length > 0
        ? {
            summary: paymentsRangeSummary(offset, rows.length, total),
            prevHref:
              offset > 0 ? paymentsListHref(search, { offset: Math.max(0, offset - limit) }) : null,
            nextHref:
              offset + rows.length < total
                ? paymentsListHref(search, { offset: offset + limit })
                : null,
          }
        : null,
  };
}

export type AdminPaymentsListPage = Awaited<ReturnType<typeof loadAdminPaymentsListPage>>;
