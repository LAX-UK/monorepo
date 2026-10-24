import { firstString, parseListSearchParams } from "@/lib/admin/admin-list-params";
import type { AdminListQueryBase, IAdminListController } from "@/lib/admin/i-admin-list-controller";
import { getAdminPaymentsListPage } from "@/lib/data/http/admin.server";
import type { AdminPaymentTableRow } from "@/lib/data/view-models/admin-payments-table.vm";
import type { PaymentStatus } from "@auction/types";
import {
  type AdminPaymentXeroFilter,
  type LotFulfilmentStatus,
  adminPaymentXeroFilterSchema,
  lotFulfilmentStatusSchema,
} from "@auction/validators";

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
  /** Lot fulfilment statuses, from `?fulfilment=in_transit,delivered`. */
  fulfilment?: LotFulfilmentStatus[] | undefined;
  /** Xero invoice state, from `?xero=linked|missing|sync_error`. */
  xero?: AdminPaymentXeroFilter | undefined;
};

/** Known fulfilment statuses from a comma-separated URL value; unknown ones are dropped. */
export function parsePaymentFulfilmentFilter(raw: string | undefined): LotFulfilmentStatus[] {
  if (!raw) return [];
  return raw
    .split(",")
    .filter(
      (value): value is LotFulfilmentStatus => lotFulfilmentStatusSchema.safeParse(value).success,
    );
}

export function parsePaymentXeroFilter(
  raw: string | undefined,
): AdminPaymentXeroFilter | undefined {
  const parsed = adminPaymentXeroFilterSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

export const paymentsListController: IAdminListController<AdminPaymentTableRow, PaymentsListQuery> =
  {
    id: "payments",
    parseQuery(sp) {
      const base = parseListSearchParams(sp);
      const st = firstString(sp.status);
      const status =
        st && st !== "all" && isPaymentListStatus(st) ? (st as PaymentStatus) : undefined;
      const fulfilment = parsePaymentFulfilmentFilter(firstString(sp.fulfilment));
      const xero = parsePaymentXeroFilter(firstString(sp.xero));
      return {
        ...base,
        status,
        ...(fulfilment.length > 0 ? { fulfilment } : {}),
        ...(xero ? { xero } : {}),
        limit: Math.min(200, base.limit),
      };
    },
    async fetch(q) {
      const page = await getAdminPaymentsListPage({
        limit: q.limit,
        offset: q.offset,
        ...(q.status ? { status: q.status } : {}),
        ...(q.q?.trim() ? { q: q.q.trim() } : {}),
        ...(q.fulfilment?.length ? { fulfilment: q.fulfilment } : {}),
        ...(q.xero ? { xero: q.xero } : {}),
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
