import type { IItemSubmissionRepository, ListSubmissionsFilter } from "@auction/persistence";
import { requireCatalogueStaff } from "./auth.js";
import { summarizeFilters } from "./export-shared.js";
import type { ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

export function createSubmissionsProvider(
  submissionRepo: IItemSubmissionRepository,
): ExportProvider<ListSubmissionsFilter> {
  return {
    entityType: "submissions",
    authorize(ctx) {
      requireCatalogueStaff(ctx);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "title", header: "title" },
      { key: "status", header: "status" },
      { key: "legalEntityId", header: "legal_entity_id" },
      { key: "createdAt", header: "created_at" },
    ],
    async estimateCount(_ctx, filters) {
      return submissionRepo.countAdmin(filters);
    },
    streamRows(_ctx, filters) {
      return batchedRows(
        (offset, limit) => submissionRepo.listForAdmin({ ...filters, offset, limit }),
        (sub) => ({
          id: sub.id,
          title: sub.title,
          status: sub.status,
          legalEntityId: sub.legalEntityId,
          createdAt: sub.createdAt.toISOString(),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
