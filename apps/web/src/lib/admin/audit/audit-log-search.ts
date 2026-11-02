import { buildListHref } from "@/lib/admin/admin-list-params";
import { dayRangeLabel } from "@/lib/admin/day-range-label";
import { domainEventLabel } from "@/lib/admin/domain-event-labels";
import { searchChipLabel } from "@auction/staff-ui";
import { type AuditLogView, isAuditLogView } from "@auction/types";
import { auditEntityTypeLabel } from "./audit-log.vm";

export const AUDIT_LOG_PATH = "/admin/audit";
export const AUDIT_LOG_PAGE_SIZE = 50;

export type AuditLogSearch = Record<string, string | string[] | undefined>;

/** The audit log's filters as the URL carries them. */
export type AuditLogFilters = {
  view: AuditLogView | null;
  q: string;
  actor: string;
  /** Display name for the chosen actor, so the chip reads as a person, not an id. */
  actorLabel: string;
  entity: string;
  action: string;
  from: string;
  to: string;
  /** Order of events; not a filter. */
  sort: AuditLogSort;
  offset: number;
};

export type AuditLogSort = "at_desc" | "at_asc";
export const AUDIT_LOG_DEFAULT_SORT: AuditLogSort = "at_desc";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseAuditLogSearch(sp: AuditLogSearch): AuditLogFilters {
  const view = first(sp.view);
  const from = first(sp.from);
  const to = first(sp.to);
  // A range typed the wrong way round is swapped rather than refused.
  const validFrom = DAY.test(from) ? from : "";
  const validTo = DAY.test(to) ? to : "";
  const [lo, hi] =
    validFrom && validTo && validFrom > validTo ? [validTo, validFrom] : [validFrom, validTo];
  const offset = Number.parseInt(first(sp.offset), 10);
  return {
    view: isAuditLogView(view) ? view : null,
    q: first(sp.q).slice(0, 100),
    actor: first(sp.actor).slice(0, 191),
    actorLabel: first(sp.actorLabel).slice(0, 120),
    entity: first(sp.entity).slice(0, 80),
    action: first(sp.action).slice(0, 120),
    from: lo,
    to: hi,
    sort: first(sp.sort) === "at_asc" ? "at_asc" : AUDIT_LOG_DEFAULT_SORT,
    offset: Number.isFinite(offset) && offset > 0 ? Math.min(offset, 50_000) : 0,
  };
}

export function hasAuditLogFilters(filters: AuditLogFilters): boolean {
  return Boolean(
    filters.view ||
      filters.q ||
      filters.actor ||
      filters.entity ||
      filters.action ||
      filters.from ||
      filters.to,
  );
}

/** The log URL with `patch` applied; any filter change returns to the first page. */
export function auditLogHref(
  current: AuditLogSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const next = { ...patch };
  // Dropping the actor drops its display name too.
  if (next.actor === null || next.actor === "") next.actorLabel = null;
  return buildListHref(AUDIT_LOG_PATH, current, { offset: null, ...next });
}

/** The log URL sorted by `sort`; the default order leaves the URL clean. */
export function auditLogSortHref(current: AuditLogSearch, sort: AuditLogSort): string {
  return auditLogHref(current, { sort: sort === AUDIT_LOG_DEFAULT_SORT ? null : sort });
}

export type AuditFilterChip = { id: string; label: string; clearHref: string };

/** One removable chip per filter that is on, worded as the filter reads in the toolbar. */
export function buildAuditFilterChips(
  filters: AuditLogFilters,
  current: AuditLogSearch,
): AuditFilterChip[] {
  const chips: AuditFilterChip[] = [];
  if (filters.q) {
    chips.push({
      id: "q",
      label: searchChipLabel(filters.q),
      clearHref: auditLogHref(current, { q: null }),
    });
  }
  if (filters.actor) {
    chips.push({
      id: "actor",
      label: `By ${filters.actorLabel || "selected person"}`,
      clearHref: auditLogHref(current, { actor: null }),
    });
  }
  if (filters.entity) {
    chips.push({
      id: "entity",
      label: `Record: ${auditEntityTypeLabel(filters.entity)}`,
      clearHref: auditLogHref(current, { entity: null }),
    });
  }
  if (filters.action) {
    chips.push({
      id: "action",
      label: `Action: ${domainEventLabel(filters.action)}`,
      clearHref: auditLogHref(current, { action: null }),
    });
  }
  if (filters.from || filters.to) {
    chips.push({
      id: "date",
      label: dayRangeLabel(filters.from, filters.to),
      clearHref: auditLogHref(current, { from: null, to: null }),
    });
  }
  return chips;
}
