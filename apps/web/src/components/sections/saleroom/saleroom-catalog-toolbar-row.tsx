"use client";

import { CatalogViewSwitcher } from "@/components/marketing/catalog-view-switcher";
import { MarketingFilterSidebar } from "@/components/marketing/marketing-filter-sidebar";
import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { SaleroomCatalogToolbar } from "@/components/sections/saleroom/saleroom-catalog-toolbar";
import type { CatalogLayoutView } from "@/lib/preferences/view-cookie";
import { DisplayHeading } from "@auction/ui";

type Props = {
  basePath: string;
  layoutView: CatalogLayoutView;
  countLabel: string;
  totalLots: number;
};

export function SaleroomCatalogToolbarRow({ basePath, layoutView, countLabel, totalLots }: Props) {
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
        filters={
          <MarketingFilterSidebar
            aria-label="Catalog filters"
            className="space-y-0 border-0 md:border-0 md:pr-0"
          >
            <SaleroomCatalogToolbar basePath={basePath} />
          </MarketingFilterSidebar>
        }
        trailing={
          <CatalogViewSwitcher
            routeKey="sales-lot"
            value={layoutView}
            supportedModes={["grid", "list"]}
          />
        }
      />
    </>
  );
}
