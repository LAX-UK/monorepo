import { AdminArtistsBoard } from "@/components/admin/admin-artists-board";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminTrendKpiBand } from "@/components/admin/admin-trend-kpi-band";
import { ArtistBackfillReviewSection } from "@/components/admin/artist-backfill-review-section";
import { ArtistDuplicateReviewSection } from "@/components/admin/artist-duplicate-review-section";
import { CatalogArtistsFilterToolbar } from "@/components/admin/catalog/catalog-artists-filter-toolbar";
import { CatalogBreadcrumbs } from "@/components/admin/catalog/catalog-breadcrumbs";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { buildListHref } from "@/lib/admin/admin-list-params";
import { buildArtistsListKpiTiles } from "@/lib/admin/artists/build-artists-list-kpi-tiles";
import { loadAdminArtistsListPage } from "@/lib/admin/catalog/load-artists-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Artists",
  "Manage canonical artist profiles and attribution.",
);

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const loaded = await loadAdminArtistsListPage(sp);
  const {
    error,
    showBackfill,
    showDuplicates,
    skipIndexedList,
    query,
    q,
    categoryOptions,
    loadError,
    artists,
    total,
    stats,
    pendingReviewCount,
    activeLensId,
    queuesHref,
    activeFilterChips,
    activeFilterCount,
    hasFilters,
    boardPagination,
    artistListPresetHref,
    canCreateArtist,
  } = loaded;

  const lenses: CatalogSegmentItem[] = [
    { id: "all", label: "All", href: artistListPresetHref("all") },
    { id: "pending", label: "Pending", href: artistListPresetHref("pending") },
    { id: "makers", label: "Maker–sellers", href: artistListPresetHref("makers") },
    { id: "featured", label: "Featured", href: artistListPresetHref("featured") },
    { id: "archived", label: "Archived", href: artistListPresetHref("archived") },
    {
      id: "queues",
      label: "Review tasks",
      href: queuesHref,
      ...(pendingReviewCount > 0 ? { badge: pendingReviewCount } : {}),
    },
    {
      id: "backfill",
      label: "Backfill",
      href: buildListHref("/admin/artists", sp, { backfill: "1", duplicates: "", offset: 0 }),
    },
  ];

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load artists">{loadError ?? error}</AdminListAlert>
    ) : null;

  const boardFilterControls = skipIndexedList
    ? undefined
    : {
        searchPlaceholder: "Search artists…",
        sheetTitle: "Artist filters",
        activeFilterCount,
        searchInputId: "admin-artists-table-search",
      };

  const artistFilterSheet = skipIndexedList
    ? undefined
    : {
        q,
        status: query.status,
        kind: query.kind ?? "",
        categoryId: query.categoryId ?? "",
        country: query.country ?? "",
        sort: query.sort,
        featured: query.featured,
        verified: query.verified,
        includeArchived: query.includeArchived,
        linked: query.linked,
      };

  const view = showBackfill ? (
    <ArtistBackfillReviewSection />
  ) : showDuplicates ? (
    <ArtistDuplicateReviewSection />
  ) : !loadError && artists.length > 0 ? (
    <AdminArtistsBoard
      artists={artists}
      canEdit={canCreateArtist}
      {...(boardFilterControls ? { filterControls: boardFilterControls } : {})}
      {...(artistFilterSheet ? { artistFilterSheet } : {})}
      categoryOptions={categoryOptions}
      {...(boardPagination ? { pagination: boardPagination } : {})}
      listTotalCount={total}
    />
  ) : null;

  const empty = skipIndexedList ? null : !loadError && artists.length === 0 ? (
    total === 0 ? (
      <CatalogListEmptyState
        title={hasFilters ? "No matching artists" : "No artists yet"}
        description={
          hasFilters
            ? "Try another lens or open More filters."
            : canCreateArtist
              ? "Create canonical profiles before assigning artist attribution to lots."
              : "No artist profiles exist yet."
        }
        action={
          hasFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/artists">Clear filters</Link>
            </Button>
          ) : canCreateArtist ? (
            <CatalogPrimaryCta href="/admin/artists/new" icon={Plus}>
              New artist
            </CatalogPrimaryCta>
          ) : null
        }
      />
    ) : (
      <CatalogListEmptyState
        title="No rows on this page"
        description="Try the previous page or clear filters — results may have shifted."
        action={
          <Button variant="secondary" asChild>
            <Link
              href={buildListHref("/admin/artists", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })}
            >
              Previous page
            </Link>
          </Button>
        }
      />
    )
  ) : null;

  return (
    <CatalogListShell
      title="Artists"
      description="Manage canonical public artist profiles, client ownership links, featured state, and attribution targets."
      breadcrumbs={
        <CatalogBreadcrumbs segments={[{ label: "Admin", href: "/admin" }, { label: "Artists" }]} />
      }
      primaryAction={
        canCreateArtist ? (
          <CatalogPrimaryCta href="/admin/artists/new" icon={Plus}>
            New artist
          </CatalogPrimaryCta>
        ) : null
      }
      empty={empty}
      filterBar={
        <CatalogArtistsFilterToolbar
          lenses={lenses}
          activeLensId={activeLensId}
          activeFilterCount={activeFilterCount}
          activeFilterChips={activeFilterChips}
          queueModesActive={skipIndexedList}
        />
      }
      toolbarEnd={
        skipIndexedList ? null : (
          <Link
            href="/admin/artists?backfill=1"
            className="min-h-11 font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary underline-offset-4 hover:underline"
          >
            Lot artist backfill
          </Link>
        )
      }
      mobileSummary={
        skipIndexedList ? null : (
          <CatalogListMobileSummary
            metrics={[
              { id: "total", label: "Total", value: String(total) },
              { id: "page", label: "On page", value: String(artists.length) },
            ]}
          />
        )
      }
      kpiStrip={
        !skipIndexedList && stats ? (
          <AdminTrendKpiBand
            ariaLabel="Artist summary"
            tiles={buildArtistsListKpiTiles({ stats, periodDays: 30 })}
          />
        ) : null
      }
      errorAlert={errorAlert}
    >
      {view}
    </CatalogListShell>
  );
}
