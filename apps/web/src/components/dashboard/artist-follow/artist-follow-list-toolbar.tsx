"use client";

import {
  DashboardActiveFilters,
  DashboardListToolbar,
  DashboardSearchField,
  DashboardSortSelect,
} from "@/components/dashboard/filters";
import {
  ARTIST_FOLLOW_BASE_PATH,
  ARTIST_FOLLOW_SORT_OPTIONS,
  type ArtistFollowFilters,
  buildArtistFollowHref,
  getArtistFollowActiveFilters,
} from "@/lib/dashboard/filters/artist-follow/artist-follow-filters";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

type Props = {
  filters: ArtistFollowFilters;
};

export function ArtistFollowListToolbar({ filters }: Props) {
  const router = useRouter();
  const activeFilters = useMemo(() => getArtistFollowActiveFilters(filters), [filters]);

  const onSortChange = useCallback(
    (value: string) => {
      router.replace(
        buildArtistFollowHref(filters, {
          sort: value as ArtistFollowFilters["sort"],
        }),
        { scroll: false },
      );
    },
    [filters, router],
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
            compactOnMobile
          />
        }
      />
      <DashboardActiveFilters filters={activeFilters} clearAllHref={ARTIST_FOLLOW_BASE_PATH} />
    </div>
  );
}
