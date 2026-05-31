import { AdminArtistsBoard } from "@/components/admin/admin-artists-board";
import { AdminListAlert } from "@/components/admin/admin-list-alert";
import { AdminListKpiStrip } from "@/components/admin/admin-list-kpi-strip";
import { ArtistBackfillReviewSection } from "@/components/admin/artist-backfill-review-section";
import { ArtistDuplicateReviewSection } from "@/components/admin/artist-duplicate-review-section";
import { CatalogArtistsFilterToolbar } from "@/components/admin/catalog/catalog-artists-filter-toolbar";
import type { CatalogSegmentItem } from "@/components/admin/catalog/catalog-filter-bar";
import { CatalogListEmptyState } from "@/components/admin/catalog/catalog-list-empty-state";
import { CatalogListMobileSummary } from "@/components/admin/catalog/catalog-list-mobile-summary";
import { CatalogListShell } from "@/components/admin/catalog/catalog-list-shell";
import { CatalogPagination } from "@/components/admin/catalog/catalog-pagination";
import { CatalogPrimaryCta } from "@/components/admin/catalog/catalog-primary-cta";
import { CatalogRelatedWork } from "@/components/admin/catalog/catalog-related-work";
import { artistsListController } from "@/lib/admin/admin-list-controllers";
import { buildListHref } from "@/lib/admin/admin-list-params";
import type { ArtistPresetId } from "@/lib/admin/artist-list-presets";
import { artistListActivePreset, artistListPresetHref } from "@/lib/admin/artist-list-presets";
import { buildArtistsActiveFilterChips } from "@/lib/admin/catalog-active-filter-chips";
import { safeDecodeAdminErrorParam } from "@/lib/admin/safe-decode-admin-error-param";
import { getAdminNavCounts } from "@/lib/data/http/admin-nav-counts.server";
import { EMPTY_ADMIN_NAV_COUNTS } from "@/lib/data/http/admin-nav-counts.types";
import { getAdminArtistStats } from "@/lib/data/http/admin.server";
import { getServerCategoryReader } from "@/lib/data/http/categories.server";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import type { CategoryNode } from "@auction/types";
import { Button } from "@auction/ui/components/button";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Artists",
  "Manage canonical artist profiles and attribution.",
);

const NAV_PRESETS = new Set<ArtistPresetId>(["all", "pending", "makers", "featured", "archived"]);

type SearchParams = Record<string, string | string[] | undefined>;

/** Flatten the category tree into indented options for the department facet. */
function flattenCategoryOptions(
  nodes: readonly CategoryNode[],
  depth = 0,
): Array<{ value: string; label: string }> {
  const out: Array<{ value: string; label: string }> = [];
  for (const node of nodes) {
    out.push({ value: node.id, label: `${"\u2014 ".repeat(depth)}${node.name}` });
    if (node.children.length > 0) out.push(...flattenCategoryOptions(node.children, depth + 1));
  }
  return out;
}

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const error = safeDecodeAdminErrorParam(sp.error);
  const showBackfill = sp.backfill === "1";
  const showDuplicates = sp.duplicates === "1";
  const skipIndexedList = showBackfill || showDuplicates;
  const navCounts = await getAdminNavCounts().catch(() => EMPTY_ADMIN_NAV_COUNTS);

  const query = artistsListController.parseQuery(sp);
  const q = query.q;

  const categoryOptions = await (async () => {
    if (skipIndexedList) return [];
    try {
      return flattenCategoryOptions(await (await getServerCategoryReader()).tree());
    } catch {
      return [];
    }
  })();

  const hasFilters = Boolean(
    showDuplicates ||
      showBackfill ||
      (!skipIndexedList &&
        (q ||
          query.includeArchived ||
          query.archivedOnly ||
          (query.kind && query.kind.trim() !== "") ||
          (query.kinds && query.kinds.trim() !== "") ||
          (query.status && query.status.trim() !== "") ||
          (query.ownerUserId && query.ownerUserId.trim() !== "") ||
          (query.categoryId && query.categoryId.trim() !== "") ||
          (query.country && query.country.trim() !== "") ||
          query.featured === true ||
          query.verified === true ||
          (query.linked && query.linked !== "any") ||
          (query.sort && query.sort.trim() !== "" && query.sort !== "name_asc"))),
  );

  let loadError: string | null = null;
  let artists: Awaited<ReturnType<typeof artistsListController.fetch>>["rows"] = [];
  let total = 0;
  let statsStrip: {
    total: string;
    pending: string;
    makers: string;
    historical: string;
    brands: string;
    featured: string;
  } | null = null;
  let pendingReviewCount = 0;

  try {
    if (!skipIndexedList) {
      const [result, stats] = await Promise.all([
        artistsListController.fetch(query),
        getAdminArtistStats().catch(() => null),
      ]);
      artists = result.rows;
      total = result.total ?? 0;
      if (stats) {
        pendingReviewCount = stats.pendingReview;
        statsStrip = {
          total: String(stats.total),
          pending: String(stats.pendingReview),
          makers: String(stats.makerSellers),
          historical: String(stats.historical),
          brands: String(stats.brands),
          featured: String(stats.featured),
        };
      }
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Could not load artists.";
  }

  const preset = artistListActivePreset(sp);

  const activeLensId =
    showDuplicates === true
      ? "queues"
      : showBackfill === true
        ? "__backfill__"
        : NAV_PRESETS.has(preset)
          ? preset
          : "all";

  const queuesHref = buildListHref("/admin/artists", sp, {
    duplicates: "1",
    backfill: "",
    offset: 0,
  });

  const lenses: CatalogSegmentItem[] = [
    { id: "all", label: "All", href: artistListPresetHref("all", sp) },
    { id: "pending", label: "Pending", href: artistListPresetHref("pending", sp) },
    { id: "makers", label: "Maker–sellers", href: artistListPresetHref("makers", sp) },
    { id: "featured", label: "Featured", href: artistListPresetHref("featured", sp) },
    { id: "archived", label: "Archived", href: artistListPresetHref("archived", sp) },
    {
      id: "queues",
      label: "Queues",
      href: queuesHref,
      ...(pendingReviewCount > 0 ? { badge: pendingReviewCount } : {}),
    },
  ];

  const categoryName =
    query.categoryId && categoryOptions.length > 0
      ? (categoryOptions.find((o) => o.value === query.categoryId)?.label ?? null)
      : null;

  const activeFilterChips = skipIndexedList
    ? []
    : buildArtistsActiveFilterChips(sp, {
        ...(q ? { q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.kind ? { kind: query.kind } : {}),
        ...(query.sort ? { sort: query.sort } : {}),
        ...(query.featured === true ? { featured: true } : {}),
        ...(query.verified === true ? { verified: true } : {}),
        ...(query.includeArchived === true ? { includeArchived: true } : {}),
        ...(query.archivedOnly === true ? { archivedOnly: true } : {}),
        ...(query.linked && query.linked !== "any" ? { linked: query.linked } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId, categoryName } : {}),
        ...(query.country ? { country: query.country } : {}),
      });

  const activeFilterCount = skipIndexedList
    ? 0
    : [
        q,
        query.status,
        query.kind,
        query.kinds,
        query.ownerUserId,
        query.categoryId,
        query.country,
        query.linked && query.linked !== "any" ? query.linked : "",
        query.archivedOnly ? "archivedOnly" : "",
        query.sort && query.sort !== "name_asc" ? query.sort : "",
        query.featured === true ? "featured" : "",
        query.verified === true ? "verified" : "",
        query.includeArchived === true ? "includeArchived" : "",
      ].filter(Boolean).length;

  const errorAlert =
    error || loadError ? (
      <AdminListAlert title="Could not load artists">{loadError ?? error}</AdminListAlert>
    ) : null;

  const view = showBackfill ? (
    <ArtistBackfillReviewSection />
  ) : showDuplicates ? (
    <ArtistDuplicateReviewSection />
  ) : !loadError && artists.length > 0 ? (
    <AdminArtistsBoard artists={artists} searchQuery={q} />
  ) : null;

  const empty = skipIndexedList ? null : !loadError && artists.length === 0 ? (
    total === 0 ? (
      <CatalogListEmptyState
        title={hasFilters ? "No matching artists" : "No artists yet"}
        description={
          hasFilters
            ? "Try another lens or open More filters."
            : "Create canonical profiles before assigning artist attribution to lots."
        }
        action={
          hasFilters ? (
            <Button variant="secondary" asChild>
              <Link href="/admin/artists">Clear filters</Link>
            </Button>
          ) : (
            <CatalogPrimaryCta href="/admin/artists/new" icon={Plus}>
              New artist
            </CatalogPrimaryCta>
          )
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

  const pagination =
    skipIndexedList ||
    loadError ||
    !(total > 0 && (query.offset > 0 || query.offset + artists.length < total)) ? null : (
      <CatalogPagination
        offset={query.offset}
        limit={query.limit}
        countOnPage={artists.length}
        prevHref={
          query.offset > 0
            ? buildListHref("/admin/artists", sp, {
                offset: Math.max(0, query.offset - query.limit),
              })
            : null
        }
        nextHref={
          query.offset + artists.length < total
            ? buildListHref("/admin/artists", sp, { offset: query.offset + query.limit })
            : null
        }
      />
    );

  return (
    <CatalogListShell
      title="Artists"
      description="Manage canonical public artist profiles, client ownership links, featured state, and attribution targets."
      meta={skipIndexedList ? null : <CatalogRelatedWork variant="artists" navCounts={navCounts} />}
      primaryAction={
        <CatalogPrimaryCta href="/admin/artists/new" icon={Plus}>
          New artist
        </CatalogPrimaryCta>
      }
      empty={empty}
      filterBar={
        <CatalogArtistsFilterToolbar
          lenses={lenses}
          activeLensId={activeLensId}
          activeFilterCount={activeFilterCount}
          activeFilterChips={activeFilterChips}
          queueModesActive={skipIndexedList}
          categoryOptions={categoryOptions}
          filterDefaults={{
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
          }}
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
        !skipIndexedList && statsStrip ? (
          <AdminListKpiStrip
            ariaLabel="Artist summary"
            tiles={[
              { label: "Total", value: statsStrip.total },
              { label: "Pending review", value: statsStrip.pending, semanticTone: "warning" },
              { label: "Maker–sellers", value: statsStrip.makers },
              { label: "Historical", value: statsStrip.historical },
              { label: "Brands", value: statsStrip.brands },
              { label: "Featured", value: statsStrip.featured },
            ]}
          />
        ) : null
      }
      errorAlert={errorAlert}
      pagination={pagination}
    >
      {view}
    </CatalogListShell>
  );
}
