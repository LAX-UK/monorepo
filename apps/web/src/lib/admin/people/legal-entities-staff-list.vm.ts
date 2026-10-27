import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildAdminListReturnTarget } from "@/lib/admin/admin-list-return-context";
import { isoDate } from "@/lib/admin/iso-date";
import type { LegalEntityHealthVM } from "@/lib/admin/legal-entity-health";
import {
  formatLegalEntityKindSubkind,
  kindLabel,
  legalEntityKindFilterOptions,
  legalEntityStatusFilterOptions,
  statusLabel,
  stripeSummaryLabel,
} from "@/lib/admin/legal-entity-list-presenter";
import { buildPeopleDetailHref } from "@/lib/admin/people/people-detail-href";
import { staffStatus } from "@/lib/admin/staff-kit-status";
import { stripeRequirementsAttentionCountForEntity } from "@/lib/admin/stripe-connect-staff-presenter";
import type {
  AdminLegalEntityListRow,
  AdminLegalEntityListSummary,
} from "@/lib/data/http/admin-legal-entities.shared";
import { searchChipLabel } from "@auction/staff-ui";
import type {
  AttentionStripItem,
  Metric,
  DataView as StaffDataView,
  StatusPresentation,
} from "@auction/staff-ui";
import type { LegalEntity, LegalEntityStatus } from "@auction/types";

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

/** What the record panel adds beyond the list row, for the one entity that is open. */
export type LegalEntityPreview = {
  row: LegalEntitiesStaffRow;
  stripeConnect: string;
  requirementsDue: number;
  laxManaged: boolean;
  /** "2.50%"; null when the entity pays the standard fee. */
  platformFee: string | null;
  health: Pick<LegalEntityHealthVM, "stageLabel" | "canPublish" | "canReceivePayouts" | "blockers">;
  creator: { id: string; name: string; email: string } | null;
  /** Null when the viewer may not see documents. */
  documents: { total: number; pending: number } | null;
};

export function toLegalEntityPreview(bundle: {
  entity: LegalEntity;
  creator: { id: string; name: string; email: string } | null;
  documents: ReadonlyArray<{ reviewStatus: string }>;
  health: LegalEntityHealthVM;
  canViewOwner: boolean;
  canViewDocuments: boolean;
}): LegalEntityPreview {
  const { entity } = bundle;
  const due = stripeRequirementsAttentionCountForEntity(entity);
  return {
    row: toLegalEntityStaffRow({
      id: entity.id,
      displayName: entity.displayName,
      status: entity.status,
      kind: entity.kind,
      subkind: entity.subkind,
      updatedAt:
        entity.updatedAt instanceof Date ? isoDate(entity.updatedAt) : String(entity.updatedAt),
      stripeDueCount: due,
    }),
    stripeConnect: entity.stripeConnectAccountId
      ? entity.stripeConnectPayoutsEnabled
        ? "Payouts enabled"
        : "Setup in progress"
      : "Not connected",
    requirementsDue: due,
    laxManaged: entity.isLaxManaged,
    platformFee:
      entity.platformFeeBps != null ? `${(entity.platformFeeBps / 100).toFixed(2)}%` : null,
    health: {
      stageLabel: bundle.health.stageLabel,
      canPublish: bundle.health.canPublish,
      canReceivePayouts: bundle.health.canReceivePayouts,
      blockers: bundle.health.blockers,
    },
    creator: bundle.canViewOwner ? bundle.creator : null,
    documents: bundle.canViewDocuments
      ? {
          total: bundle.documents.length,
          pending: bundle.documents.filter((doc) => doc.reviewStatus === "pending").length,
        }
      : null,
  };
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

/** The list with an entity's panel open (`?entity=`), or closed when `entityId` is null. */
export function legalEntityPanelHref(
  search: LegalEntitiesListSearch,
  entityId: string | null,
): string {
  const base: LegalEntitiesListSearch = { ...search };
  for (const key of ["error", "success"]) delete base[key];
  return buildListHref(LEGAL_ENTITIES_LIST_PATH, base, { entity: entityId });
}

/** The entity's record page, remembering this list so "Back" returns to it. */
export function legalEntityRecordHref(
  search: LegalEntitiesListSearch,
  entityId: string,
  tab?: "stripe",
): string {
  const returnTo = buildAdminListReturnTarget(LEGAL_ENTITIES_LIST_PATH, search);
  const href = buildPeopleDetailHref(`${LEGAL_ENTITIES_LIST_PATH}/${entityId}`, returnTo);
  if (!tab) return href;
  return `${href}${href.includes("?") ? "&" : "?"}tab=${tab}`;
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
