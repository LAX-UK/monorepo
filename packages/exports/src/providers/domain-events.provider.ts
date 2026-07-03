import { requireCatalogueStaff, requirePlatformAdminAccess, resolveIncludePii } from "./auth.js";
import { summarizeFilters } from "./export-shared.js";
import type { IExportDomainEventsQuery } from "./ports/export-domain-events.query.js";
import type { ExportProvider } from "./types.js";
import { batchedRows } from "./types.js";

export function createDomainEventsProvider(domainEvents: IExportDomainEventsQuery): ExportProvider<{
  aggregateType?: string;
  aggregateId?: string;
  includePii?: boolean;
}> {
  return {
    entityType: "domain-events",
    authorize(ctx, filters) {
      const aggType = filters.aggregateType?.trim();
      const aggId = filters.aggregateId?.trim();
      if (aggType && aggId) {
        requireCatalogueStaff(ctx);
      } else {
        requirePlatformAdminAccess(ctx);
      }
      resolveIncludePii(ctx, filters.includePii);
    },
    columns: () => [
      { key: "id", header: "id" },
      { key: "aggregateType", header: "aggregate_type" },
      { key: "aggregateId", header: "aggregate_id" },
      { key: "eventType", header: "event_type" },
      { key: "actorUserId", header: "actor_user_id" },
      { key: "actingLegalEntityId", header: "acting_legal_entity_id" },
      { key: "occurredAt", header: "occurred_at" },
      { key: "payloadJson", header: "payload_json" },
    ],
    async estimateCount(_ctx, filters) {
      return domainEvents.countForExport({
        ...(filters.aggregateType ? { aggregateType: filters.aggregateType } : {}),
        ...(filters.aggregateId ? { aggregateId: filters.aggregateId } : {}),
      });
    },
    streamRows(ctx, filters) {
      const includePii = resolveIncludePii(ctx, filters.includePii);
      const scope = {
        includePii,
        ...(filters.aggregateType ? { aggregateType: filters.aggregateType } : {}),
        ...(filters.aggregateId ? { aggregateId: filters.aggregateId } : {}),
      };
      return batchedRows(
        (offset, limit) => domainEvents.listRedacted({ ...scope, limit, offset }),
        (r) => ({
          id: String(r.id),
          aggregateType: r.aggregateType,
          aggregateId: r.aggregateId,
          eventType: r.eventType,
          actorUserId: r.actorUserId ?? "",
          actingLegalEntityId: r.actingLegalEntityId ?? "",
          occurredAt: r.occurredAt.toISOString(),
          payloadJson: JSON.stringify(r.payload),
        }),
      );
    },
    filterSummary: (_ctx, filters) => summarizeFilters(filters as Record<string, unknown>),
  };
}
