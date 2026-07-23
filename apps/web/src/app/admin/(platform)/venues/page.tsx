import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { AdminVenueCreateSheet } from "@/components/admin/admin-venue-create-sheet";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { CatalogVenuesFilterToolbar } from "@/components/admin/catalog/catalog-venues-filter-toolbar";
import { AdminVenuesBoard } from "@/components/admin/venues-board";
import { venuesListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref, firstString } from "@/lib/admin/admin-list-params";
import { buildSnapshotKpiTile } from "@/lib/admin/build-snapshot-kpi-tile";
import { buildVenuesActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { enrichVenueListWithLegalEntityNames } from "@/lib/admin/enrich-venue-list-rows";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { resolvePlatformCatalogLegalEntity } from "@/lib/data/http/platform-catalog.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { AdminVenueListRow } from "@/lib/services/interfaces/admin-venue-service";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

export const metadata: Metadata = metadataForPrivate(
  "Venues",
  "Manage reusable onsite gallery and branch information.",
);

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminVenuesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const openNewSheet = firstString(sp.new)?.trim() === "1";
  const error = safeDecodeAdminErrorParam(sp.error);
  const query = venuesListController.parseQuery(sp);
  const includeArchived = query.includeArchived ?? false;
  const q = query.q ?? "";
  const legalEntityId = query.legalEntityId;

  let venues: AdminVenueListRow[] = [];
  let total = 0;
  let listError: string | null = null;
  let platformLegalEntityId: string | null = null;

  const [listResult, platformCatalog] = await Promise.allSettled([
    (async () => {
      const result = await venuesListController.fetch(query);
      venues = result.rows;
      total = result.total ?? venues.length;
    })(),
    resolvePlatformCatalogLegalEntity(),
  ]);

  if (listResult.status === "rejected") {
    listError =
      listResult.reason instanceof Error ? listResult.reason.message : "Could not load venues.";
  } else if (venues.length > 0) {
    venues = await enrichVenueListWithLegalEntityNames(venues);
  }

  if (platformCatalog.status === "fulfilled" && platformCatalog.value.ok) {
    platformLegalEntityId = platformCatalog.value.id;
  }

  // Resolve the display name for the active org filter chip
  let legalEntityDisplayName: string | null = null;
  if (legalEntityId) {
    const { resolveAdminLegalEntityForPickerAction } = await import(
      "@/lib/actions/admin-legal-entities-browse"
    );
    const resolved = await resolveAdminLegalEntityForPickerAction(legalEntityId).catch(() => null);
    if (resolved?.ok && resolved.data) {
      legalEntityDisplayName = resolved.data.displayName;
    }
  }

  const lenses: CatalogSegmentItem[] = [
    {
      id: "active",
      label: "Active",
      href: buildListHref("/admin/venues", sp, { includeArchived: "", offset: 0 }),
    },
    {
      id: "archived",
      label: "Include archived",
      href: buildListHref("/admin/venues", sp, { includeArchived: "true", offset: 0 }),
    },
  ];
  const activeLensId = includeArchived ? "archived" : "active";
  const activeFilterCount = [q, legalEntityId, includeArchived ? "includeArchived" : ""].filter(
    Boolean,
  ).length;
  const hasFilters = Boolean(q || legalEntityId || includeArchived);
  const activeFilterChips = buildVenuesActiveFilterChips(sp, {
    q,
    includeArchived,
    ...(legalEntityId ? { legalEntityId } : {}),
    legalEntityName: legalEntityDisplayName,
  });

  const errorAlert =
    error || listError ? (
      <AdminListAlert title="Could not load venues">{listError ?? error}</AdminListAlert>
    ) : null;

  const empty =
    !listError && venues.length === 0 ? (
      <CatalogListEmptyState
        title={hasFilters ? "No matching venues" : "No venues yet"}
        description={
          hasFilters
            ? "Try another search term, switch the archive lens, or clear the organisation filter."
            : "Create a reusable onsite venue before setting up gallery sales."
        }
        action={
          hasFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/venues">Clear filters</Link>
            </Button>
          ) : (
            <CatalogPrimaryCta href="/admin/venues?new=1" icon={Plus}>
              New venue
            </CatalogPrimaryCta>
          )
        }
      />
    ) : null;

  const boardPagination =
    !listError && total > 0 && (query.offset > 0 || query.offset + venues.length < total)
      ? {
          offset: query.offset,
          limit: query.limit,
          countOnPage: venues.length,
          total,
          prevHref:
            query.offset > 0
              ? buildListHref("/admin/venues", sp, {
                  offset: Math.max(0, query.offset - query.limit),
                })
              : null,
          nextHref:
            query.offset + venues.length < total
              ? buildListHref("/admin/venues", sp, { offset: query.offset + query.limit })
              : null,
        }
      : null;

  return (
    <>
      <Suspense fallback={null}>
        <AdminVenueCreateSheet
          platformLegalEntityId={platformLegalEntityId}
          sheetFromQuery={openNewSheet}
        />
      </Suspense>
      <CatalogListShell
        title="Venues"
        description="Reusable onsite gallery and branch locations. Each venue belongs to a legal entity — only venues owned by the sale operator can be attached to a sale."
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[{ label: "Admin", href: "/admin" }, { label: "Venues" }]}
          />
        }
        primaryAction={
          <CatalogPrimaryCta href="/admin/venues?new=1" icon={Plus}>
            New venue
          </CatalogPrimaryCta>
        }
        empty={empty}
        errorAlert={errorAlert}
        filterBar={
          <CatalogVenuesFilterToolbar
            lenses={lenses}
            activeLensId={activeLensId}
            activeFilterCount={activeFilterCount}
            activeFilterChips={activeFilterChips}
            legalEntityId={legalEntityId ?? null}
            legalEntityDisplayName={legalEntityDisplayName}
          />
        }
        mobileSummary={
          !listError && venues.length > 0 ? (
            <CatalogListMobileSummary
              segments={[
                `${venues.length} on page`,
                total > 0 ? `${total} total` : null,
                includeArchived ? "Include archived" : null,
              ]}
            />
          ) : null
        }
        kpiStrip={
          !listError ? (
            <AdminTrendKpiBand
              ariaLabel="Venues summary"
              tiles={[
                buildSnapshotKpiTile("On this page", venues.length, 30, {
                  compareHint: `${total} matching`,
                  trendTone: "secondary",
                }),
                buildSnapshotKpiTile("Matching venues", total, 30, {
                  compareHint: includeArchived ? "Including archived" : "Active lens",
                  trendTone: "info",
                }),
              ]}
            />
          ) : null
        }
      >
        {!listError && venues.length > 0 ? (
          <AdminVenuesBoard venues={venues} pagination={boardPagination} listTotalCount={total} />
        ) : null}
      </CatalogListShell>
    </>
  );
}
