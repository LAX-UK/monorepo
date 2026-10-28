import { requireFinanceRead } from "./auth.js";
import { summarizeFilters } from "./export-shared.js";
import type {
  IPaymentWriteRepository,
  ListPaymentsAdminTableFilter,
  PaymentRecord,
} from "./ports/payment-write.js";
import type { ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

/**
 * What the staff Payments list sends: the same filters as the list itself (the status view,
 * the search and the filter sheet), so the file holds exactly the rows the list shows.
 */
export type PaymentsExportFilters = {
  status?: string;
  manualReview?: boolean;
  q?: string;
  /** Lot fulfilment statuses, as a list or comma-separated. */
  fulfilment?: string | readonly string[];
  xero?: string;
};

const PAYMENT_STATUSES: ReadonlySet<string> = new Set([
  "pending",
  "authorized",
  "captured",
  "refunded",
  "requires_manual_review",
  "cancelled",
]);
const XERO_FILTERS: ReadonlySet<string> = new Set(["linked", "missing", "sync_error"]);

/** The list's filters as the admin table query; unknown values are dropped, never guessed. */
export function paymentsExportQuery(
  filters: PaymentsExportFilters,
): Omit<ListPaymentsAdminTableFilter, "limit" | "offset"> {
  const out: Omit<ListPaymentsAdminTableFilter, "limit" | "offset"> = {};
  if (filters.manualReview === true) {
    out.status = "requires_manual_review";
  } else if (filters.status && PAYMENT_STATUSES.has(filters.status)) {
    out.status = filters.status as PaymentRecord["status"];
  }
  const q = typeof filters.q === "string" ? filters.q.trim() : "";
  if (q) out.q = q;
  const fulfilment = (
    typeof filters.fulfilment === "string"
      ? filters.fulfilment.split(",")
      : (filters.fulfilment ?? [])
  )
    .map((value) => value.trim())
    .filter(Boolean);
  if (fulfilment.length > 0) out.fulfilmentStatuses = fulfilment;
  if (filters.xero && XERO_FILTERS.has(filters.xero)) {
    out.xeroInvoice = filters.xero as NonNullable<ListPaymentsAdminTableFilter["xeroInvoice"]>;
  }
  return out;
}

export function createPaymentsProvider(
  paymentRepo: Pick<IPaymentWriteRepository, "listForAdminTable" | "countForAdminTable">,
): ExportProvider<PaymentsExportFilters> {
  return {
    entityType: "payments",
    authorize(ctx) {
      requireFinanceRead(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "lotId", header: "lot_id" },
      { key: "lotTitle", header: "lot_title" },
      { key: "buyerId", header: "buyer_id" },
      { key: "amount", header: "amount" },
      { key: "status", header: "status" },
      { key: "fulfilmentStatus", header: "fulfilment_status" },
      { key: "xeroInvoiceNumber", header: "xero_invoice" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return paymentRepo.countForAdminTable(paymentsExportQuery(filters));
    },
    streamRows(_ctx, filters) {
      const query = paymentsExportQuery(filters);
      return batchedRows(
        (offset, limit) => paymentRepo.listForAdminTable({ ...query, offset, limit }),
        (p) => ({
          id: p.id,
          lotId: p.lotId,
          lotTitle: p.lotTitle,
          buyerId: p.buyerId || (p.paidByUserId ?? ""),
          amount: p.amount,
          status: p.status,
          fulfilmentStatus: p.fulfilmentStatus ?? "",
          xeroInvoiceNumber: p.xeroInvoiceNumber ?? "",
          createdAt: p.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
