import type { ISaleRepository, ListSalesFilter } from "@auction/persistence";
import { requireCatalogueStaff } from "./auth.js";
import { summarizeFilters } from "./export-shared.js";
import type { ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

export function createSalesProvider(saleRepo: ISaleRepository): ExportProvider<ListSalesFilter> {
  return {
    entityType: "sales",
    authorize(ctx) {
      requireCatalogueStaff(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "title", header: "title" },
      { key: "status", header: "status" },
      { key: "deliveryMode", header: "delivery_mode" },
      { key: "startTime", header: "start_time" },
      { key: "endTime", header: "end_time" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return saleRepo.countMatching(filters);
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        (offset, limit) => saleRepo.list({ ...filters, offset, limit }),
        (s) => ({
          id: s.id,
          title: s.title,
          status: s.status,
          deliveryMode: s.deliveryMode,
          startTime: s.startTime?.toISOString() ?? "",
          endTime: s.endTime?.toISOString() ?? "",
          createdAt: s.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
