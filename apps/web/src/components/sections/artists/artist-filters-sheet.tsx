"use client";

import { MarketingFilterSheet } from "@/components/marketing/marketing-filter-sheet";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { ArtistDirectoryFilters } from "@/components/sections/artists/artist-directory-filters";
import type { ArtistDirectoryFilterLink } from "@/components/sections/artists/artist-directory-filters";
import {
  ArtistSortSheetGroup,
  type ArtistSortValue,
} from "@/components/sections/artists/artist-sort-sheet-group";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

type FilterGroup = {
  id: string;
  title: string;
  links: ArtistDirectoryFilterLink[];
};

export type ArtistFiltersSheetProps = {
  activeCount: number;
  canonicalPath: string;
  sort: ArtistSortValue;
  groups: FilterGroup[];
  nationalityLinks?: ArtistDirectoryFilterLink[];
  clearHref: string;
  hasFilters: boolean;
  resultCountLabel: string;
};

/** Mobile filter sheet for the public artist directory (`/artists` and presets). */
export function ArtistFiltersSheet({
  activeCount,
  canonicalPath,
  sort,
  groups,
  nationalityLinks,
  clearHref,
  hasFilters,
  resultCountLabel,
}: ArtistFiltersSheetProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const close = useCallback(() => setOpen(false), []);

  return (
    <MarketingFilterSheet
      open={open}
      onOpenChange={setOpen}
      title="Filters"
      trigger={<MarketingFilterTrigger activeCount={activeCount} />}
      applyLabel={resultCountLabel}
      onApply={close}
      onReset={() => {
        router.push(clearHref);
        close();
      }}
    >
      <div className="flex flex-col gap-8">
        <ArtistDirectoryFilters
          groups={groups}
          {...(nationalityLinks !== undefined ? { nationalityLinks } : {})}
          clearHref={clearHref}
          hasFilters={hasFilters}
          onLinkClick={close}
        />
        <ArtistSortSheetGroup canonicalPath={canonicalPath} value={sort} onSelect={close} />
      </div>
    </MarketingFilterSheet>
  );
}
