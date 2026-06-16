"use client";

import { HydrationDeferred } from "@/components/layout/hydration-deferred";
import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingFilterSidebar } from "@/components/marketing/marketing-filter-sidebar";
import { MarketingFilterTrigger } from "@/components/marketing/marketing-filter-trigger";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { SaleroomCatalogActiveFilters } from "@/components/sections/saleroom/saleroom-catalog-active-filters";
import { SaleroomCatalogFilterSheet } from "@/components/sections/saleroom/saleroom-catalog-filter-sheet";
import { SaleroomCatalogSearch } from "@/components/sections/saleroom/saleroom-catalog-search";
import { SaleroomCatalogToolbar } from "@/components/sections/saleroom/saleroom-catalog-toolbar";
import { FilterSelect } from "@/components/ui/filter-select";
import { SALEROOM_CATALOG_SORT_OPTIONS } from "@/lib/marketing/saleroom-catalog-sort";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui";
import { useSearchParams } from "next/navigation";

type Props = {
  basePath: string;
  layoutView: CatalogLayoutView;
  countLabel: string;
  resultCountLabel: string;
  totalLots: number;
};

export function SaleroomCatalogToolbarRow({
  basePath,
  layoutView,
  countLabel,
  resultCountLabel,
  totalLots,
}: Props) {
  const params = useSearchParams();
  const sortValue = params?.get("sort") ?? "lot";
  const sortLabel =
    SALEROOM_CATALOG_SORT_OPTIONS.find((o) => o.value === sortValue)?.label ?? "Lot order";

  return (
    <>
      <div className="mb-4 flex items-baseline gap-2 border-b border-outline-variant/30 pb-2.5">
        <DisplayHeading as="h2" id="sale-catalog-heading" size="section" className="font-semibold">
          Lots
        </DisplayHeading>
        <span className="font-headline text-[length:var(--text-title-section)] font-semibold leading-tight text-on-surface-variant">
          ({totalLots})
        </span>
      </div>
      <MarketingListToolbar
        countLabel={countLabel}
        stackTrailingOnMobile
        mobileFilterTrigger={
          <HydrationDeferred fallback={<MarketingFilterTrigger activeCount={0} />}>
            <SaleroomCatalogFilterSheet basePath={basePath} resultCountLabel={resultCountLabel} />
          </HydrationDeferred>
        }
        filters={
          <MarketingFilterSidebar
            aria-label="Catalog filters"
            className="space-y-0 border-0 md:border-0 md:pr-0"
          >
            <SaleroomCatalogToolbar basePath={basePath} />
          </MarketingFilterSidebar>
        }
        sort={
          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden w-44 sm:block">
              <SaleroomCatalogSearch />
            </div>
            <HydrationDeferred
              fallback={
                <span
                  className="inline-flex h-10 min-h-10 items-center rounded-md border border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface-variant"
                  aria-label={`Sort: ${sortLabel}`}
                >
                  {sortLabel}
                </span>
              }
            >
              <FilterSelect
                param="sort"
                defaultValue="lot"
                options={[...SALEROOM_CATALOG_SORT_OPTIONS]}
                clearParams={["page"]}
                ariaLabel="Sort lots"
                className="h-10 min-h-10 w-auto min-w-[9.5rem] max-w-[12rem] cursor-pointer border-outline-variant/40 bg-surface-container-lowest px-3 font-label text-[0.65rem] font-semibold uppercase tracking-wider shadow-none focus:ring-primary"
              />
            </HydrationDeferred>
          </div>
        }
        trailing={
          <CatalogViewSwitcher
            routeKey="sales-lot"
            value={layoutView}
            supportedModes={["grid", "list"]}
          />
        }
      />
      <div className="mt-3 sm:hidden">
        <SaleroomCatalogSearch />
      </div>
      <SaleroomCatalogActiveFilters basePath={basePath} />
    </>
  );
}
