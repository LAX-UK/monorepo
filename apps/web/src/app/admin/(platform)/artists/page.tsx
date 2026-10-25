import { ArtistBackfillReviewSection } from "@/components/admin/artist-backfill-review-section";
import { ArtistDuplicateReviewSection } from "@/components/admin/artist-duplicate-review-section";
import { ArtistsStaffList } from "@/components/admin/artists/artists-staff-list";
import {
  artistsActiveLens,
  artistsAttention,
  artistsFilterChips,
  artistsFiltered,
  artistsListHref,
  artistsMetrics,
  artistsRangeSummary,
  artistsViews,
  toArtistsStaffRows,
} from "@/lib/admin/artists/artists-staff-list.vm";
import { countryPickerOptions } from "@/lib/admin/artists/country-options";
import { loadAdminArtistsListPage } from "@/lib/admin/catalog/load-artists-list-page";
import { metadataForPrivate } from "@/lib/seo/metadata-factory";
import { PageHeader, StaffBreadcrumbs, type StaffLinkComponent } from "@auction/staff-ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForPrivate(
  "Artists",
  "Manage canonical artist profiles and attribution.",
);

const NextLink: StaffLinkComponent = Link;

type SearchParams = Record<string, string | string[] | undefined>;

const QUEUES = {
  duplicates: {
    title: "Possible duplicate artists",
    description: "Profiles that look like the same artist. Merge them into one, or leave them.",
  },
  backfill: {
    title: "Lot artist backfill",
    description: "Lots whose artist was typed as text. Match each one to a canonical profile.",
  },
} as const;

export default async function AdminArtistsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const page = await loadAdminArtistsListPage(sp);

  if (page.queue) {
    const copy = QUEUES[page.queue];
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title={copy.title}
          description={copy.description}
          breadcrumbs={
            <StaffBreadcrumbs
              Link={NextLink}
              items={[{ label: "Artists", href: "/admin/artists" }, { label: copy.title }]}
            />
          }
        />
        {page.queue === "duplicates" ? (
          <ArtistDuplicateReviewSection />
        ) : (
          <ArtistBackfillReviewSection />
        )}
      </div>
    );
  }

  const { query, rows, total, stats } = page;
  const categoryLabel = query.categoryId
    ? (page.categoryOptions.find((option) => option.id === query.categoryId)?.label ?? null)
    : null;

  return (
    <ArtistsStaffList
      rows={toArtistsStaffRows(rows)}
      search={sp}
      views={artistsViews(sp, stats)}
      activeLens={artistsActiveLens(query)}
      attention={artistsAttention(sp, {
        pendingReview: stats?.pendingReview ?? 0,
        backfillTasks: page.backfillTasks,
      })}
      metrics={stats ? artistsMetrics(stats) : null}
      filterChips={artistsFilterChips(sp, query, categoryLabel)}
      categoryOptions={page.categoryOptions}
      countryOptions={countryPickerOptions()}
      pageSize={query.limit}
      pagination={
        rows.length > 0
          ? {
              summary: artistsRangeSummary(query.offset, rows.length, total),
              prevHref:
                query.offset > 0
                  ? artistsListHref(sp, { offset: Math.max(0, query.offset - query.limit) })
                  : null,
              nextHref:
                query.offset + rows.length < total
                  ? artistsListHref(sp, { offset: query.offset + query.limit })
                  : null,
            }
          : null
      }
      permissions={page.permissions}
      listError={page.loadError}
      filtered={artistsFiltered(query)}
    />
  );
}
