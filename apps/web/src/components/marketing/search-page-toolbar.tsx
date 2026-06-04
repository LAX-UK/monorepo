"use client";

import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { SaveSearchButton } from "@/components/marketing/save-search-button";
import { SearchActiveFilters } from "@/components/marketing/search-active-filters";
import { SearchCategoryChips } from "@/components/marketing/search-category-chips";
import { SearchFilterSheet } from "@/components/marketing/search-filter-sheet";
import { SearchSortSelect, type SearchSortValue } from "@/components/marketing/search-sort-select";
import { SearchStatusChips } from "@/components/marketing/search-status-chips";
import type { SearchEndingWindow } from "@/lib/marketing/parse-search-params";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { Category, LotStatus } from "@auction/types";

export type SearchPageToolbarProps = {
  countLabel?: string | undefined;
  activeCount: number;
  initialQ: string;
  sort: SearchSortValue;
  categoryId?: string | undefined;
  layoutView: CatalogLayoutView;
  categories: Category[];
  trimmed: string;
  resultCountLabel: string;
  status?: LotStatus;
  ending?: SearchEndingWindow;
};

/** Sticky search catalogue toolbar: slim row + filter sheet. */
export function SearchPageToolbar({
  countLabel,
  activeCount,
  initialQ,
  sort,
  categoryId,
  layoutView,
  categories,
  trimmed,
  resultCountLabel,
  status,
  ending,
}: SearchPageToolbarProps) {
  return (
    <>
      <MarketingListToolbar
        className="-mx-8 md:-mx-10 lg:-mx-14"
        {...(countLabel ? { countLabel } : {})}
        mobileFilterTrigger={
          <SearchFilterSheet
            activeCount={activeCount}
            initialQ={initialQ}
            sort={sort}
            categoryId={categoryId}
            view={layoutView}
            categories={categories}
            trimmed={trimmed}
            resultCountLabel={resultCountLabel}
            {...(status ? { status } : {})}
            {...(ending ? { ending } : {})}
          />
        }
        filters={
          <SearchCategoryChips
            categories={categories}
            categoryId={categoryId}
            trimmed={trimmed}
            sort={sort}
            view={layoutView}
            {...(status ? { status } : {})}
            {...(ending ? { ending } : {})}
          />
        }
        sort={
          <div className="flex shrink-0 items-center gap-2">
            <SaveSearchButton
              compact
              className="hidden md:inline-flex"
              label={trimmed ? `Search: ${trimmed}` : "Catalogue search"}
              query={{
                ...(trimmed ? { q: trimmed } : {}),
                sort,
                view: layoutView,
                ...(categoryId ? { categoryId } : {}),
                ...(status ? { status } : {}),
                ...(ending ? { ending } : {}),
              }}
            />
            <SearchSortSelect value={sort} />
          </div>
        }
        trailing={<CatalogViewSwitcher routeKey="search" value={layoutView} />}
        secondaryRow={
          <SearchStatusChips
            trimmed={trimmed}
            sort={sort}
            view={layoutView}
            categoryId={categoryId}
            {...(status ? { status } : {})}
            {...(ending ? { ending } : {})}
          />
        }
        activeFiltersRow={<SearchActiveFilters categories={categories} sort={sort} />}
      />
      <div className="mt-3 flex flex-col gap-2 md:hidden">
        <SearchStatusChips
          trimmed={trimmed}
          sort={sort}
          view={layoutView}
          categoryId={categoryId}
          {...(status ? { status } : {})}
          {...(ending ? { ending } : {})}
        />
        <SearchCategoryChips
          categories={categories}
          categoryId={categoryId}
          trimmed={trimmed}
          sort={sort}
          view={layoutView}
          {...(status ? { status } : {})}
          {...(ending ? { ending } : {})}
        />
      </div>
    </>
  );
}
