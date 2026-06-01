import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { LegalEntitiesBoard } from "@/components/admin/legal-entities/legal-entities-board";
import { LegalEntitiesFilterToolbar } from "@/components/admin/legal-entities/legal-entities-filter-toolbar";
import { LegalEntitiesMobileCards } from "@/components/admin/legal-entities/legal-entities-mobile-cards";
import { PeopleListShell } from "@/components/admin/people/people-list-shell";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { legalEntitiesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import {
  buildLegalEntityActiveFilterChips,
  countLegalEntityListActiveFilters,
  hasLegalEntityListActiveFilters,
  parseLegalEntityListFilters,
} from "@/lib/admin/legal-entity-list-query";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import type { AdminLegalEntityListRow } from "@/lib/data/http/admin.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { PaginationFooter } from "@auction/ui";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Legal entities",
  "Browse organisation and selling entity records.",
);

export default async function AdminLegalEntitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const listFilters = parseLegalEntityListFilters(sp);
  const stripeLens = listFilters.stripeLens === true;
  const query = legalEntitiesListController.parseQuery(sp);

  let rows: AdminLegalEntityListRow[] = [];
  let total = 0;
  let loadError: string | null = null;

  try {
    const result = await legalEntitiesListController.fetch(query);
    rows = result.rows;
    total = result.total ?? 0;
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load legal entities.";
  }

  const activeFilterChips = buildLegalEntityActiveFilterChips(
    "/admin/legal-entities",
    sp,
    listFilters,
  );
  const activeFilterCount = countLegalEntityListActiveFilters(listFilters);
  const hasFilters = hasLegalEntityListActiveFilters(listFilters);
  const stripeDueOnPage = rows.filter((r) => r.stripeDueCount > 0).length;

  const chip = (patch: Record<string, string | number | boolean | undefined | null | "">) =>
    buildListHref("/admin/legal-entities", sp, { ...patch, offset: 0 });

  const viewLenses = [
    { id: "all", label: "All", href: chip({ stripe: false }) },
    { id: "stripe", label: "Stripe requirements", href: chip({ stripe: true }) },
  ] as const;

  const pagination =
    !loadError && total > 0 ? (
      <PaginationFooter
        offset={query.offset}
        limit={query.limit}
        countOnPage={rows.length}
        total={total}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/legal-entities", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + rows.length < total
            ? buildListHref("/admin/legal-entities", sp, {
                offset: query.offset + query.limit,
              })
            : null
        }
      />
    ) : null;

  return (
    <PeopleListShell
      title="Legal entities"
      description="Browse organisation and selling entities. Filter by status, kind, or Stripe requirements."
      hasFilters={hasFilters}
      resetHref="/admin/legal-entities"
      filtersSelfContained
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={[
              { id: "total", label: "Total entities", value: String(total) },
              {
                id: "stripe",
                label: stripeLens ? "On this page" : "Stripe due (page)",
                value: String(stripeDueOnPage),
              },
            ]}
          />
        ) : null
      }
      kpiStrip={
        !loadError ? (
          <AdminListKpiStrip
            ariaLabel="Legal entities summary"
            tiles={[
              {
                label: stripeLens ? "Stripe queue" : "Total entities",
                value: total,
                delta: `${rows.length} on this page`,
              },
              {
                label: "Requirements due",
                value: stripeDueOnPage,
                delta: "On this page",
              },
              {
                label: "Approved on page",
                value: rows.filter((r) => r.status === "approved").length,
                delta: "Current page",
              },
              {
                label: "Under review on page",
                value: rows.filter((r) => r.status === "under_review").length,
                delta: "Current page",
              },
            ]}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load legal entities">
            {loadError ?? error}
          </AdminListAlert>
        ) : null
      }
      filters={
        !loadError ? (
          <LegalEntitiesFilterToolbar
            lenses={viewLenses}
            activeLensId={stripeLens ? "stripe" : "all"}
            activeFilterCount={activeFilterCount}
            activeFilterChips={activeFilterChips}
          />
        ) : null
      }
      view={
        !loadError && rows.length > 0 ? (
          <LegalEntitiesBoard rows={rows} stripeLens={stripeLens} />
        ) : null
      }
      mobileCards={
        !loadError && rows.length > 0 ? (
          <LegalEntitiesMobileCards rows={rows} stripeLens={stripeLens} />
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <FilterEmptyState
            entity="legal entities"
            segment="admin"
            hasActiveFilters={hasFilters}
            clearFiltersHref="/admin/legal-entities"
          />
        ) : null
      }
      showCommandPaletteHint={!loadError && rows.length === 0}
      pagination={pagination}
    />
  );
}
