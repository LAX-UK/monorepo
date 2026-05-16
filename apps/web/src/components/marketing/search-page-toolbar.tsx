"use client";

import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { CopyCatalogLinkButton } from "@/components/marketing/copy-catalog-link-button";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { SearchCategoryChips } from "@/components/marketing/search-category-chips";
import { SearchFilterSheet } from "@/components/marketing/search-filter-sheet";
import { SearchSortSelect, type SearchSortValue } from "@/components/marketing/search-sort-select";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import type { Category } from "@auction/types";

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
};

/** Sticky search catalogue toolbar: slim row + mobile category strip + filter sheet. */
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
}: SearchPageToolbarProps) {
  return (
    <>
      <MarketingListToolbar
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
          />
        }
        filters={
          <SearchCategoryChips
            categories={categories}
            categoryId={categoryId}
            trimmed={trimmed}
            sort={sort}
            view={layoutView}
          />
        }
        sort={<SearchSortSelect value={sort} />}
        trailing={
          <>
            <CopyCatalogLinkButton />
            <CatalogViewSwitcher routeKey="search" value={layoutView} />
          </>
        }
      />
      {categories.length > 0 ? (
        <div className="border-b border-outline-variant/10 bg-surface/85 px-4 py-2 backdrop-blur-md md:hidden">
          <SearchCategoryChips
            categories={categories}
            categoryId={categoryId}
            trimmed={trimmed}
            sort={sort}
            view={layoutView}
          />
        </div>
      ) : null}
    </>
  );
}
