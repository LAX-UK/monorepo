import { requireFinanceRead } from "./auth.js";
import { summarizeFilters } from "./export-shared.js";
import type {
  IPaymentWriteRepository,
  ListPaymentsExportFilter,
  PaymentRecord,
} from "./ports/payment-write.js";
import type { ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

function paymentExportFilter(filters: {
  status?: string;
  manualReview?: boolean;
}): ListPaymentsExportFilter {
  const out: ListPaymentsExportFilter = {};
  if (filters.manualReview === true) {
    out.manualReview = true;
  } else if (filters.status) {
    out.status = filters.status as PaymentRecord["status"];
  }
  return out;
}

export function createPaymentsProvider(
  paymentRepo: Pick<IPaymentWriteRepository, "listForExport" | "countForExport">,
): ExportProvider<{ status?: string; manualReview?: boolean }> {
  return {
    entityType: "payments",
    authorize(ctx) {
      requireFinanceRead(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "lotId", header: "lot_id" },
      { key: "buyerId", header: "buyer_id" },
      { key: "amount", header: "amount" },
      { key: "status", header: "status" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return paymentRepo.countForExport(paymentExportFilter(filters));
    },
    streamRows(_ctx, filters) {
      const exportFilter = paymentExportFilter(filters);
      return batchedRows(
        (offset, limit) => paymentRepo.listForExport({ ...exportFilter, offset, limit }),
        (p) => ({
          id: p.id,
          lotId: p.lotId,
          buyerId: p.paidByUserId ?? "",
          amount: p.amount,
          status: p.status,
          createdAt: p.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
