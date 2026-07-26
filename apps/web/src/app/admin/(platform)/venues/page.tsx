import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { CatalogVenuesFilterToolbar } from "@/components/admin/catalog/catalog-venues-filter-toolbar";
import { AdminVenuesBoard } from "@/components/admin/venues-board";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildVenuesListKpiTiles } from "@/lib/admin/catalog/build-venues-list-kpi-tiles";
import { loadAdminVenuesListPage } from "@/lib/admin/catalog/load-venues-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

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
  if ((sp.new ?? "").toString().trim() === "1") {
    redirect("/admin/venues/new");
  }
  const loaded = await loadAdminVenuesListPage(sp);
  const {
    error,
    venues,
    total,
    listError,
    legalEntityId,
    legalEntityDisplayName,
    includeArchived,
    activeLensId,
    activeFilterCount,
    hasFilters,
    activeFilterChips,
    boardPagination,
  } = loaded;

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
            <CatalogPrimaryCta href="/admin/venues/new" icon={Plus}>
              New venue
            </CatalogPrimaryCta>
          )
        }
      />
    ) : null;

  return (
    <>
      <CatalogListShell
        title="Venues"
        description="Reusable onsite gallery and branch locations. Each venue belongs to a legal entity — only venues owned by the sale operator can be attached to a sale."
        breadcrumbs={
          <CatalogBreadcrumbs
            segments={[{ label: "Admin", href: "/admin" }, { label: "Venues" }]}
          />
        }
        primaryAction={
          <CatalogPrimaryCta href="/admin/venues/new" icon={Plus}>
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
            legalEntityId={legalEntityId}
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
              tiles={buildVenuesListKpiTiles({
                countOnPage: venues.length,
                total,
                includeArchived,
              })}
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
