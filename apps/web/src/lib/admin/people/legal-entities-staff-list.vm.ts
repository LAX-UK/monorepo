import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  formatLegalEntityKindSubkind,
  kindLabel,
  legalEntityKindFilterOptions,
  legalEntityStatusFilterOptions,
  statusLabel,
  stripeSummaryLabel,
} from "@/lib/admin/legal-entity-list-presenter";
import { listQueryOf, panelParamRedirect } from "@/lib/admin/list-record";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import type {
  AdminLegalEntityListRow,
  AdminLegalEntityListSummary,
} from "@/lib/data/http/admin-legal-entities.shared";
import {
  type AttentionStripItem,
  type Metric,
  type SortState,
  type DataView as StaffDataView,
  type StatusPresentation,
  decodeSort,
  encodeSort,
  recordHrefInList,
  searchChipLabel,
} from "@auction/staff-ui";
import type { LegalEntityStatus } from "@auction/types";

export const LEGAL_ENTITIES_LIST_PATH = "/admin/legal-entities";

export type LegalEntitiesListSearch = Record<string, string | string[] | undefined>;

/** One legal entity as the staff list shows it; plain data, so it crosses to the client as is. */
export type LegalEntitiesStaffRow = {
  id: string;
  name: string;
  /** "Organisation · Gallery". */
  kind: string;
  status: LegalEntityStatus;
  statusPresentation: StatusPresentation;
  stripeDueCount: number;
  /** "2 requirements due"; null when nothing is due. */
  stripe: string | null;
  updatedAt: string;
};

export function toLegalEntityStaffRow(entity: {
  id: string;
  displayName: string;
  status: LegalEntityStatus;
  kind: AdminLegalEntityListRow["kind"];
  subkind: AdminLegalEntityListRow["subkind"];
  updatedAt: string;
  stripeDueCount: number;
}): LegalEntitiesStaffRow {
  return {
    id: entity.id,
    name: entity.displayName,
    kind: formatLegalEntityKindSubkind(entity.kind, entity.subkind),
    status: entity.status,
    statusPresentation: staffStatus("legalEntity", entity.status),
    stripeDueCount: entity.stripeDueCount,
    stripe: entity.stripeDueCount > 0 ? stripeSummaryLabel(entity.stripeDueCount) : null,
    updatedAt: entity.updatedAt,
  };
}

export function toLegalEntitiesStaffRows(
  rows: readonly AdminLegalEntityListRow[],
): LegalEntitiesStaffRow[] {
  return rows.map(toLegalEntityStaffRow);
}

/** A link to the legal entities list with some of its URL state changed; paging restarts. */
export function legalEntitiesListHref(
  search: LegalEntitiesListSearch,
  patch: Record<string, string | number | null | undefined>,
): string {
  const base: LegalEntitiesListSearch = { ...search };
  for (const key of ["error", "success", "entity"]) delete base[key];
  return buildListHref(LEGAL_ENTITIES_LIST_PATH, base, {
    ...("offset" in patch ? {} : { offset: null }),
    ...patch,
  });
}

/** A legal entity's page. */
export function legalEntityHref(entityId: string): string {
  return `${LEGAL_ENTITIES_LIST_PATH}/${encodeURIComponent(entityId)}`;
}

/**
 * The entity's page (or one of its tabs), remembering this list (`?list=`) so the page can step
 * through the same rows and lead back to the list as it was.
 */
export function legalEntityRecordHref(
  search: LegalEntitiesListSearch,
  entityId: string,
  tab?: "stripe",
): string {
  const href = legalEntityHref(entityId);
  return recordHrefInList(tab ? `${href}/${tab}` : href, listQueryOf(search, ["entity"]));
}

/**
 * An old panel link (`/admin/legal-entities?entity=ID`) opens the entity's page now, still in the
 * list it named; null when there is no `?entity=`.
 */
export function legalEntityPanelRedirect(search: LegalEntitiesListSearch): string | null {
  return panelParamRedirect(search, "entity", legalEntityHref);
}

/** Most recently updated first, unless the URL says otherwise; the default stays out of the URL. */
export const LEGAL_ENTITIES_DEFAULT_SORT: SortState = { columnId: "updated", direction: "desc" };

const LEGAL_ENTITIES_SORTABLE = ["name", "stripe", "updated"] as const;

/** The sort in the URL (`?sort=name`), or the default for a missing or unknown one. */
export function legalEntitiesSortState(sort: string | string[] | undefined): SortState {
  const decoded = decodeSort(typeof sort === "string" ? sort : sort?.[0]);
  return decoded && (LEGAL_ENTITIES_SORTABLE as readonly string[]).includes(decoded.columnId)
    ? decoded
    : LEGAL_ENTITIES_DEFAULT_SORT;
}

/** The list sorted by a column, back on its first page. */
export function legalEntitiesSortHref(search: LegalEntitiesListSearch, sort: SortState): string {
  const isDefault =
    sort.columnId === LEGAL_ENTITIES_DEFAULT_SORT.columnId &&
    sort.direction === LEGAL_ENTITIES_DEFAULT_SORT.direction;
  return legalEntitiesListHref(search, { sort: isDefault ? null : encodeSort(sort) });
}

function compareLegalEntities(
  a: LegalEntitiesStaffRow,
  b: LegalEntitiesStaffRow,
  columnId: string,
): number {
  if (columnId === "stripe") return a.stripeDueCount - b.stripeDueCount;
  if (columnId === "name") {
    return a.name.toLocaleLowerCase("en-GB").localeCompare(b.name.toLocaleLowerCase("en-GB"));
  }
  return a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0;
}

/**
 * The page of legal entities in the URL's order. The API does not sort, so the server sorts the
 * rows it loaded, as the list did in the browser before; ties keep the API's order.
 */
export function sortLegalEntitiesStaffRows(
  rows: readonly LegalEntitiesStaffRow[],
  sort: SortState,
): LegalEntitiesStaffRow[] {
  const sign = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => sign * compareLegalEntities(a, b, sort.columnId));
}

export type LegalEntitiesViewId = "all" | "stripe";

export function activeLegalEntitiesView(search: LegalEntitiesListSearch): LegalEntitiesViewId {
  return search.stripe === "1" ? "stripe" : "all";
}

export function legalEntitiesViews(
  search: LegalEntitiesListSearch,
  summary: AdminLegalEntityListSummary,
): StaffDataView[] {
  return [
    { id: "all", label: "All", href: legalEntitiesListHref(search, { stripe: null }) },
    {
      id: "stripe",
      label: "Stripe requirements",
      href: legalEntitiesListHref(search, { stripe: "1" }),
      ...(summary.stripeDueCount > 0 ? { count: summary.stripeDueCount } : {}),
    },
  ];
}

/** Work waiting on the onboarding desk, each linking to the view that holds it. */
export function legalEntitiesAttention(
  search: LegalEntitiesListSearch,
  summary: AdminLegalEntityListSummary,
  view: LegalEntitiesViewId,
): AttentionStripItem[] {
  const underReview = summary.byStatus.under_review;
  return [
    ...(view === "stripe"
      ? []
      : [
          {
            id: "stripe",
            count: summary.stripeDueCount,
            label:
              summary.stripeDueCount === 1
                ? "legal entity has Stripe requirements due"
                : "legal entities have Stripe requirements due",
            href: legalEntitiesListHref(search, { stripe: "1" }),
            tone: "warning" as const,
          },
        ]),
    {
      id: "review",
      count: underReview,
      label: underReview === 1 ? "legal entity is under review" : "legal entities are under review",
      href: legalEntitiesListHref(search, { status: "under_review", stripe: null }),
    },
  ];
}

/** The directory-wide summary: it covers every legal entity, whatever the view. */
export function legalEntitiesMetrics(summary: AdminLegalEntityListSummary): Metric[] {
  const count = new Intl.NumberFormat("en-GB");
  return [
    { id: "total", label: "Legal entities", value: count.format(summary.total) },
    { id: "approved", label: "Approved", value: count.format(summary.byStatus.approved) },
    {
      id: "review",
      label: "In review",
      value: count.format(summary.byStatus.under_review + summary.byStatus.connect_pending),
    },
    { id: "stripe", label: "Stripe requirements due", value: count.format(summary.stripeDueCount) },
  ];
}

export const LEGAL_ENTITY_STATUS_FILTERS = legalEntityStatusFilterOptions();
export const LEGAL_ENTITY_KIND_FILTERS = legalEntityKindFilterOptions();

const listParam = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : "";

/** The filters in force beyond the view, as chips, each with the link that removes it. */
export function legalEntitiesFilterChips(
  search: LegalEntitiesListSearch,
): Array<{ id: string; label: string; clearHref: string }> {
  const q = listParam(search.q).trim();
  const status = LEGAL_ENTITY_STATUS_FILTERS.find((o) => o.value === listParam(search.status));
  const kind = LEGAL_ENTITY_KIND_FILTERS.find((o) => o.value === listParam(search.kind));
  return [
    ...(q
      ? [
          {
            id: "q",
            label: searchChipLabel(q),
            clearHref: legalEntitiesListHref(search, { q: null }),
          },
        ]
      : []),
    ...(status
      ? [
          {
            id: "status",
            label: `Status: ${statusLabel(status.value as LegalEntityStatus)}`,
            clearHref: legalEntitiesListHref(search, { status: null }),
          },
        ]
      : []),
    ...(kind
      ? [
          {
            id: "kind",
            label: `Kind: ${kindLabel(kind.value)}`,
            clearHref: legalEntitiesListHref(search, { kind: null }),
          },
        ]
      : []),
  ];
}

/** "1–50 of 312 legal entities". */
export function legalEntitiesRangeSummary(offset: number, shown: number, total: number): string {
  const count = new Intl.NumberFormat("en-GB");
  const noun = total === 1 ? "legal entity" : "legal entities";
  return `${count.format(offset + 1)}–${count.format(offset + shown)} of ${count.format(total)} ${noun}`;
}
