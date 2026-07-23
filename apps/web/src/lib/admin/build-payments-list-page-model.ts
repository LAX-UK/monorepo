import { paymentStatusesForChip, paymentsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { CatalogActiveFilterChip } from "@/lib/admin/catalog/types";
import { manualReviewListController } from "@/lib/admin/manual-review-list-controller";
import { manualReviewReasonLabel } from "@/lib/admin/manual-review-presenter";

const PAYMENTS_LIST_PATH = "/admin/payments";

export type PaymentsListSearchParams = {
  error?: string;
  status?: string;
  q?: string;
  limit?: string;
  offset?: string;
  period?: string;
  manualReview?: string;
  manualReviewReason?: string;
  success?: string;
};

export function buildPaymentsListPageModel(sp: PaymentsListSearchParams) {
  const manualReviewQuery = manualReviewListController.parseQuery(sp);
  const manualReviewQueue = manualReviewQuery.manualReview;
  const manualReviewReasonFilter = manualReviewQuery.reasonFilter;
  const query = paymentsListController.parseQuery(sp);
  const paymentQ = query.q ?? "";
  const hasListFilters = Boolean(query.status || paymentQ.trim());

  const buildPaginationHref = (patch: Record<string, string | number | undefined>) =>
    buildListHref(PAYMENTS_LIST_PATH, sp, patch);

  const statusChipSpecs = [
    {
      id: "manual-review",
      label: "Manual review",
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "",
        status: "",
        offset: 0,
      }),
      active: manualReviewQueue && !manualReviewReasonFilter,
    },
    {
      id: "manual-review-finance",
      label: "Finance",
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "finance",
        status: "",
        offset: 0,
      }),
      active: manualReviewQueue && manualReviewReasonFilter === "finance",
    },
    {
      id: "manual-review-compliance",
      label: "Compliance",
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "compliance",
        status: "",
        offset: 0,
      }),
      active: manualReviewQueue && manualReviewReasonFilter === "compliance",
    },
    ...paymentStatusesForChip.map((s) => ({
      id: s,
      label: s,
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        status: s === "all" ? "" : s,
        manualReview: "",
        offset: 0,
      }),
      active:
        !manualReviewQueue && ((s === "all" && query.status === undefined) || query.status === s),
    })),
  ];

  const manualReviewReasonChipSpecs = [
    {
      id: "mr-all",
      label: "All holds",
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "",
        offset: 0,
      }),
      active: !manualReviewReasonFilter,
    },
    {
      id: "mr-finance",
      label: "Finance holds",
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "finance",
        offset: 0,
      }),
      active: manualReviewReasonFilter === "finance",
    },
    {
      id: "mr-compliance-all",
      label: "Compliance holds",
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "compliance",
        offset: 0,
      }),
      active: manualReviewReasonFilter === "compliance",
    },
    {
      id: "mr-aml",
      label: manualReviewReasonLabel("aml_hold"),
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "aml_hold",
        offset: 0,
      }),
      active: manualReviewReasonFilter === "aml_hold",
    },
    {
      id: "mr-sof",
      label: manualReviewReasonLabel("source_of_funds_required"),
      href: buildListHref(PAYMENTS_LIST_PATH, sp, {
        manualReview: "1",
        manualReviewReason: "source_of_funds_required",
        offset: 0,
      }),
      active: manualReviewReasonFilter === "source_of_funds_required",
    },
  ];

  const searchFilterChips: CatalogActiveFilterChip[] =
    paymentQ.trim().length > 0
      ? [
          {
            id: "q",
            label: `Search: ${paymentQ.trim()}`,
            clearHref: buildListHref(PAYMENTS_LIST_PATH, sp, { q: "", offset: 0 }),
          },
        ]
      : [];

  const exportFilters = {
    ...(query.status ? { status: query.status } : {}),
  };

  return {
    query,
    manualReviewQuery,
    manualReviewQueue,
    manualReviewReasonFilter,
    paymentQ,
    hasListFilters,
    statusChipSpecs,
    manualReviewReasonChipSpecs,
    searchFilterChips,
    exportFilters,
    buildPaginationHref,
  };
}
