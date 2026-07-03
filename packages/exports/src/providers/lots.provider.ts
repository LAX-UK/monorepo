import type { ILotRepository, ListLotsFilter } from "@auction/persistence";
import { requireCatalogueStaff } from "./auth.js";
import { summarizeFilters } from "./export-shared.js";
import type { ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

export function createLotsProvider(lotRepo: ILotRepository): ExportProvider<ListLotsFilter> {
  return {
    entityType: "lots",
    authorize(ctx) {
      requireCatalogueStaff(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "lotNumber", header: "lot_number" },
      { key: "title", header: "title" },
      { key: "status", header: "status" },
      { key: "saleId", header: "sale_id" },
      { key: "sellerLegalEntityId", header: "seller_legal_entity_id" },
      { key: "currentPrice", header: "current_price" },
      { key: "startTime", header: "start_time" },
      { key: "endTime", header: "end_time" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return lotRepo.countMatching(filters);
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        (offset, limit) => lotRepo.list({ ...filters, offset, limit }),
        (lot) => ({
          id: lot.id,
          lotNumber: lot.lotNumber ?? "",
          title: lot.title,
          status: lot.status,
          saleId: lot.saleId ?? "",
          sellerLegalEntityId: lot.sellerLegalEntityId ?? "",
          currentPrice: lot.currentPrice,
          startTime: lot.startTime?.toISOString() ?? "",
          endTime: lot.endTime?.toISOString() ?? "",
          createdAt: lot.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
