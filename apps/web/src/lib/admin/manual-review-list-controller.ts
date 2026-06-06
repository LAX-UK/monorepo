import { firstString } from "@/lib/admin/admin-list-params";
import type { AdminManualReviewPaymentRow } from "@/lib/data/http/admin.server";
import { getAdminManualReviewPayments } from "@/lib/data/http/admin.server";
import {
  type ManualReviewQueueSummary,
  filterManualReviewRows,
  summarizeManualReviewQueue,
} from "@/lib/data/view-models/admin-manual-review.vm";

export type ManualReviewListQuery = {
  manualReview: boolean;
  reasonFilter: string;
};

export type ManualReviewListResult = {
  rows: AdminManualReviewPaymentRow[];
  allRows: AdminManualReviewPaymentRow[];
  summary: ManualReviewQueueSummary;
};

export const manualReviewListController = {
  id: "manual-review",
  parseQuery(searchParams: Record<string, string | string[] | undefined>): ManualReviewListQuery {
    const manualReview = firstString(searchParams.manualReview) === "1";
    const reasonFilter = firstString(searchParams.manualReviewReason)?.trim() ?? "";
    return { manualReview, reasonFilter };
  },
  async fetch(query: ManualReviewListQuery): Promise<ManualReviewListResult> {
    const allRows = await getAdminManualReviewPayments();
    const rows = filterManualReviewRows(allRows, query.reasonFilter);
    return {
      rows,
      allRows,
      summary: summarizeManualReviewQueue(allRows),
    };
  },
};
