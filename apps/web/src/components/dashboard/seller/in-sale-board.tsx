"use client";

import type { InSaleDisplayRow } from "@/app/dashboard/seller/in-sale/in-sale.vm";
import { FilterEmptyState } from "@/components/app/filter-empty-state";
import { DashboardFilterResultsAnnouncer } from "@/components/dashboard/filters";
import {
  InSaleDesktopList,
  InSaleMobileList,
} from "@/components/dashboard/list/in-sale-mobile-list";
import { DashboardEmptyState } from "@/components/dashboard/primitives";
import { DASHBOARD_CTA, DASHBOARD_EMPTY, DASHBOARD_ROUTES } from "@/lib/dashboard/dashboard-copy";
import {
  type InSaleFilters,
  hasInSaleActiveFilters,
} from "@/lib/dashboard/filters/in-sale/in-sale-filters";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const PAGE_PATH = "/dashboard/seller/in-sale";

type Props = {
  filters: InSaleFilters;
  allDisplay: InSaleDisplayRow[];
  filtered: InSaleDisplayRow[];
};

export function InSaleBoard({ filters, allDisplay, filtered }: Props) {
  return (
    <>
      <DashboardFilterResultsAnnouncer count={filtered.length} entityLabel="lots" />

      <section>
        {allDisplay.length === 0 ? (
          <DashboardEmptyState
            title={DASHBOARD_EMPTY.sellerInSale.title}
            description={DASHBOARD_EMPTY.sellerInSale.description}
            action={
              <Button variant="primary" asChild>
                <Link href={DASHBOARD_ROUTES.submissionsNew}>{DASHBOARD_CTA.newSubmission}</Link>
              </Button>
            }
          />
        ) : null}

        {allDisplay.length > 0 && filtered.length === 0 && hasInSaleActiveFilters(filters) ? (
          <FilterEmptyState segment="dashboard" entity="lots" clearFiltersHref={PAGE_PATH} />
        ) : null}

        {filtered.length > 0 ? (
          <>
            <InSaleMobileList rows={filtered} />
            <InSaleDesktopList rows={filtered} />
          </>
        ) : null}
      </section>
    </>
  );
}
