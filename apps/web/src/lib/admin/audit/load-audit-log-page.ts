import "server-only";

import { getAdminAuditLog } from "@/lib/data/http/admin-audit.reader";
import {
  AUDIT_LOG_PAGE_SIZE,
  AUDIT_LOG_PATH,
  type AuditLogSearch,
  auditLogHref,
  buildAuditFilterChips,
  hasAuditLogFilters,
  parseAuditLogSearch,
} from "./audit-log-search";
import { type AuditLogRowModel, toAuditLogRows } from "./audit-log.vm";

export type AuditLogPagination = {
  summary: string;
  prevHref: string | null;
  nextHref: string | null;
};

/** Data and composition boundary for `/admin/audit`. */
export async function loadAdminAuditLogPage(
  sp: AuditLogSearch,
  viewer: { canOpenPlatformRoutes: boolean },
) {
  const filters = parseAuditLogSearch(sp);
  const model = {
    filters,
    hasFilters: hasAuditLogFilters(filters),
    chips: buildAuditFilterChips(filters, sp),
    clearAllHref: filters.view ? `${AUDIT_LOG_PATH}?view=${filters.view}` : AUDIT_LOG_PATH,
  };

  try {
    const page = await getAdminAuditLog({
      limit: AUDIT_LOG_PAGE_SIZE,
      offset: filters.offset,
      sort: filters.sort,
      ...(filters.q ? { q: filters.q } : {}),
      ...(filters.actor ? { actorUserId: filters.actor } : {}),
      ...(filters.view ? { view: filters.view } : {}),
      ...(filters.entity ? { aggregateType: filters.entity } : {}),
      ...(filters.action ? { eventTypes: [filters.action] } : {}),
      ...(filters.from ? { from: filters.from } : {}),
      ...(filters.to ? { to: filters.to } : {}),
    });
    const rows: AuditLogRowModel[] = toAuditLogRows(page.rows, viewer);
    const first = filters.offset + 1;
    const last = filters.offset + rows.length;
    const pagination: AuditLogPagination | null =
      rows.length > 0 && (filters.offset > 0 || last < page.total)
        ? {
            summary: `${first}–${last} of ${page.total} events`,
            prevHref:
              filters.offset > 0
                ? auditLogHrefAt(sp, Math.max(0, filters.offset - AUDIT_LOG_PAGE_SIZE))
                : null,
            nextHref:
              last < page.total ? auditLogHrefAt(sp, filters.offset + AUDIT_LOG_PAGE_SIZE) : null,
          }
        : rows.length > 0
          ? {
              summary: `${page.total} ${page.total === 1 ? "event" : "events"}`,
              prevHref: null,
              nextHref: null,
            }
          : null;
    return { model, rows, total: page.total, pagination, loadError: null as string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return {
      model,
      rows: [] as AuditLogRowModel[],
      total: 0,
      pagination: null,
      loadError:
        message === "forbidden"
          ? "You do not have access to the audit log."
          : "The audit log could not be loaded. Try again in a moment.",
    };
  }
}

function auditLogHrefAt(sp: AuditLogSearch, offset: number): string {
  // Paging keeps every filter; only the offset moves.
  return auditLogHref(sp, { offset: offset > 0 ? offset : null });
}
