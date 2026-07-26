import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListPreviewDegradedAlert } from "@/components/admin/admin-list-preview-degraded-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { AdminLegalEntitiesBoardContainer } from "@/components/admin/legal-entities-board/container";
import { LegalEntitiesFilterToolbar } from "@/components/admin/legal-entities/legal-entities-filter-toolbar";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import {
  buildLegalEntitiesListKpiTiles,
  buildLegalEntitiesMobileMetrics,
} from "@/lib/admin/people/build-legal-entities-list-kpi-tiles";
import { loadAdminLegalEntitiesListPage } from "@/lib/admin/people/load-legal-entities-list-page";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { Metadata } from "next";

export const metadata: Metadata = metadataForPrivate(
  "Legal entities",
  "Browse organisation and selling entity records.",
);

type Props = {
  searchParams: Promise<{
    error?: string;
    success?: string;
    q?: string;
    status?: string;
    kind?: string;
    stripe?: string;
    limit?: string;
    offset?: string;
    entity?: string;
  }>;
};

export default async function AdminLegalEntitiesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const loaded = await loadAdminLegalEntitiesListPage(sp);
  const { model, rows, summary, total, loadError, preview, pagination } = loaded;
  const isPaginationEmpty = !loadError && total > 0 && rows.length === 0 && !model.hasFilters;
  const previewDegraded = !loadError && Boolean(model.selectedEntityId && !preview);

  const chip = (patch: Record<string, string | number | boolean | undefined | null | "">) =>
    model.buildPaginationHref({ ...patch, offset: 0 });

  const viewLenses = [
    { id: "all", label: "All", href: chip({ stripe: false }) },
    { id: "stripe", label: "Stripe requirements", href: chip({ stripe: true }) },
  ] as const;

  return (
    <CatalogListShell
      title="Legal entities"
      description="Browse organisation and selling entities. Filter by status, kind, or Stripe requirements."
      hasFilters={model.hasFilters}
      resetHref={model.basePath}
      filtersSelfContained
      mobileSummary={
        !loadError ? (
          <CatalogListMobileSummary
            metrics={buildLegalEntitiesMobileMetrics({
              summary,
              stripeLens: model.stripeLens,
              pageCount: rows.length,
            })}
          />
        ) : null
      }
      kpiStrip={
        !loadError ? (
          <AdminTrendKpiBand
            ariaLabel="Legal entities summary"
            tiles={buildLegalEntitiesListKpiTiles({
              summary,
              stripeLens: model.stripeLens,
            })}
          />
        ) : null
      }
      errorAlert={
        error || loadError ? (
          <AdminListAlert title="Could not load legal entities">
            {loadError ?? error}
          </AdminListAlert>
        ) : previewDegraded ? (
          <AdminListPreviewDegradedAlert
            entityLabel="legal entity"
            clearHref={model.buildDrawerHref(null)}
          />
        ) : null
      }
      filters={
        !loadError ? (
          <LegalEntitiesFilterToolbar
            lenses={viewLenses}
            activeLensId={model.stripeLens ? "stripe" : "all"}
            activeFilterCount={model.activeFilterCount}
            activeFilterChips={model.activeFilterChips}
          />
        ) : null
      }
      empty={
        !loadError && rows.length === 0 ? (
          <FilterEmptyState
            entity="legal entities"
            segment="admin"
            hasActiveFilters={model.hasFilters}
            clearFiltersHref={model.basePath}
            {...(isPaginationEmpty
              ? {
                  title: "No legal entities on this page",
                  description: "Try a previous page or adjust pagination.",
                }
              : {})}
          />
        ) : null
      }
      pagination={null}
    >
      {!loadError && rows.length > 0 ? (
        <AdminLegalEntitiesBoardContainer
          rows={rows}
          stripeLens={model.stripeLens}
          selectedEntityId={model.selectedEntityId}
          preview={preview}
          listReturnTarget={model.listReturnTarget}
          pagination={pagination}
        />
      ) : null}
    </CatalogListShell>
  );
}
