"use client";

import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingFilterSidebar } from "@/components/marketing/marketing-filter-sidebar";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { SaleroomCatalogActiveFilters } from "@/components/sections/saleroom/saleroom-catalog-active-filters";
import { LazySaleroomCatalogFilterSheet } from "@/components/sections/saleroom/saleroom-catalog-filter-sheet.lazy";
import { SaleroomCatalogSearch } from "@/components/sections/saleroom/saleroom-catalog-search";
import { LazySaleroomCatalogSort } from "@/components/sections/saleroom/saleroom-catalog-sort.lazy";
import { SaleroomCatalogToolbar } from "@/components/sections/saleroom/saleroom-catalog-toolbar";
import {
  MARKETING_LIST_TOOLBAR_BLEED,
  SALE_CATALOG_TOOLBAR_STICKY_TOP,
} from "@/lib/marketing/chrome";
import { SALEROOM_CATALOG_SORT_OPTIONS } from "@/lib/marketing/saleroom-catalog-sort";
import type { SaleroomStatusCounts } from "@/lib/marketing/saleroom-status-counts";
import type { CatalogueControls } from "@/lib/marketing/saleroom/catalogue-controls";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui/components/typography";
import { useSearchParams } from "next/navigation";

type Props = {
  basePath: string;
  layoutView: CatalogLayoutView;
  countLabel: string;
  resultCountLabel: string;
  /** What this sale's size earns: lots only, the toolbar, or the toolbar with search. */
  controls: CatalogueControls;
  /** Lots per status; null when they could not be counted. */
  statusCounts: SaleroomStatusCounts | null;
};

export function SaleroomCatalogToolbarRow({
  basePath,
  layoutView,
  countLabel,
  resultCountLabel,
  controls,
  statusCounts,
}: Props) {
  const params = useSearchParams();
  const sortValue = params?.get("sort") ?? "lot";
  const sortLabel =
    SALEROOM_CATALOG_SORT_OPTIONS.find((o) => o.value === sortValue)?.label ?? "Lot order";

  return (
    <>
      <div className="mb-4 border-b border-outline-variant/30 pb-2.5">
        <DisplayHeading as="h2" id="sale-catalog-heading" size="section" className="font-semibold">
          Lots
        </DisplayHeading>
      </div>
      {controls.toolbar ? (
        <MarketingListToolbar
          className={MARKETING_LIST_TOOLBAR_BLEED}
          stickyTopClassName={SALE_CATALOG_TOOLBAR_STICKY_TOP}
          countLabel={countLabel}
          mobileFilterTrigger={
            <LazySaleroomCatalogFilterSheet
              basePath={basePath}
              resultCountLabel={resultCountLabel}
              statusCounts={statusCounts}
            />
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
              {controls.search ? (
                <div className="hidden w-44 sm:block">
                  <SaleroomCatalogSearch />
                </div>
              ) : null}
              <LazySaleroomCatalogSort sortLabel={sortLabel} />
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
      ) : null}
      {controls.toolbar && controls.search ? (
        <div className="mt-3 sm:hidden">
          <SaleroomCatalogSearch />
        </div>
      ) : null}
      <SaleroomCatalogActiveFilters basePath={basePath} />
    </>
  );
}
