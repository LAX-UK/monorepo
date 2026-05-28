"use client";

import {
  DashboardActiveFilters,
  DashboardFilterSection,
  DashboardFilterSheet,
  DashboardFilterTrigger,
  DashboardListToolbar,
  DashboardSearchField,
  DashboardSortSelect,
} from "@/components/dashboard/filters";
import {
  ARTIST_FOLLOW_BASE_PATH,
  ARTIST_FOLLOW_SORT_OPTIONS,
  type ArtistFollowFilters,
  type ArtistFollowSort,
  buildArtistFollowHref,
  getArtistFollowActiveFilters,
} from "@/lib/dashboard/filters/artist-follow/artist-follow-filters";
import { FilterChip } from "@auction/ui";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

type Props = {
  filters: ArtistFollowFilters;
};

export function ArtistFollowListToolbar({ filters }: Props) {
  const router = useRouter();
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const activeFilters = useMemo(() => getArtistFollowActiveFilters(filters), [filters]);
  const mobileSheetCount = filters.sort !== "addedDesc" ? 1 : 0;

  const onSortChange = useCallback(
    (value: string) => {
      router.replace(
        buildArtistFollowHref(filters, {
          sort: value as ArtistFollowSort,
        }),
        { scroll: false },
      );
    },
    [filters, router],
  );

  const navigateSort = useCallback(
    (value: ArtistFollowSort) => {
      router.replace(buildArtistFollowHref(filters, { sort: value }), { scroll: false });
      setMobileSheetOpen(false);
    },
    [filters, router],
  );

  const mobileFilterSheet = (
    <DashboardFilterSheet
      open={mobileSheetOpen}
      onOpenChange={setMobileSheetOpen}
      title="Sort artists"
      description="Choose how followed artists are ordered."
      trigger={<DashboardFilterTrigger activeCount={mobileSheetCount} />}
    >
      <DashboardFilterSection label="Sort by">
        <div className="flex flex-wrap gap-2">
          {ARTIST_FOLLOW_SORT_OPTIONS.map((opt) => (
            <FilterChip
              key={opt.value}
              pressed={filters.sort === opt.value}
              onClick={() => navigateSort(opt.value)}
            >
              {opt.label}
            </FilterChip>
          ))}
        </div>
      </DashboardFilterSection>
    </DashboardFilterSheet>
  );

  return (
    <div className="space-y-3">
      <DashboardListToolbar
        searchLabel="Filter followed artists"
        search={
          <DashboardSearchField
            initialQ={filters.q}
            label="Search artists"
            placeholder="Filter by artist name…"
            inputId="artist-follow-q"
          />
        }
        sort={
          <DashboardSortSelect
            label="Sort"
            value={filters.sort}
            options={ARTIST_FOLLOW_SORT_OPTIONS}
            onValueChange={onSortChange}
          />
        }
        hideSortOnMobile
        mobileFilterSheet={mobileFilterSheet}
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={ARTIST_FOLLOW_BASE_PATH} />
    </div>
  );
}
