import { MarketingChipStrip } from "@/components/marketing/marketing-chip-strip";
import {
  SearchCategoryChips,
  type SearchCategoryChipsProps,
} from "@/components/marketing/search-category-chips";
import { SearchStatusChips } from "@/components/marketing/search-status-chips";

export type SearchCatalogFilterChipsProps = SearchCategoryChipsProps;

/** Single scroll strip: category + status filters (search catalogue desktop). */
export function SearchCatalogFilterChips(props: SearchCatalogFilterChipsProps) {
  return (
    <MarketingChipStrip aria-label="Catalog filters">
      <SearchCategoryChips {...props} layout="bare" />
      <span
        className="mx-0.5 hidden h-5 w-px shrink-0 self-center bg-border-hairline lg:block"
        aria-hidden
      />
      <SearchStatusChips
        trimmed={props.trimmed}
        sort={props.sort}
        view={props.view}
        categoryId={props.categoryId}
        {...(props.status ? { status: props.status } : {})}
        {...(props.ending ? { ending: props.ending } : {})}
        layout="bare"
      />
    </MarketingChipStrip>
  );
}
