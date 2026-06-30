import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { getAdminPaymentsListPage } from "@/lib/data/http/admin.server";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import type { PaymentStatus } from "@auction/types";

export const paymentStatusesForChip: (PaymentStatus | "all")[] = [
  "all",
  "pending",
  "authorized",
  "captured",
  "refunded",
];

function isPaymentListStatus(s: string): s is PaymentStatus {
  return (
    s === "pending" ||
    s === "authorized" ||
    s === "captured" ||
    s === "refunded" ||
    s === "requires_manual_review"
  );
}

export type PaymentsListQuery = AdminListQueryBase & {
  status?: PaymentStatus | undefined;
};

export const paymentsListController: IAdminListController<AdminPaymentTableRow, PaymentsListQuery> =
  {
    id: "payments",
    parseQuery(sp) {
      const base = parseListSearchParams(sp);
      const st = firstString(sp.status);
      const status =
        st && st !== "all" && isPaymentListStatus(st) ? (st as PaymentStatus) : undefined;
      return { ...base, status, limit: Math.min(200, base.limit) };
    },
    async fetch(q) {
      const page = await getAdminPaymentsListPage({
        limit: q.limit,
        offset: q.offset,
        ...(q.status ? { status: q.status } : {}),
        ...(q.q?.trim() ? { q: q.q.trim() } : {}),
      });
      return {
        rows: page.rows,
        total: page.total,
        offset: page.offset,
        limit: page.limit,
        paymentsSummary: page.summary,
      };
    },
  };
