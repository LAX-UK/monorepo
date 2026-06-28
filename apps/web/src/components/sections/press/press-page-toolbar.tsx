"use client";

import { MarketingListToolbar } from "@/components/marketing/marketing-list-toolbar";
import { PressActiveFilters } from "@/components/sections/press/press-active-filters";
import { PressFilterForm } from "@/components/sections/press/press-filter-form";
import { PressFilterSheet } from "@/components/sections/press/press-filter-sheet";
import { FOCUS_RING, MARKETING_PAGE_GUTTER_X } from "@/lib/marketing/chrome";
import {
  type PressHubParams,
  countActivePressHubFilters,
  formatPressApplyButtonLabel,
} from "@/lib/marketing/press-params";
import { cn } from "@auction/ui";
import { Rss } from "lucide-react";
import Link from "next/link";

export type PressPageToolbarProps = {
  params: PressHubParams;
  years: number[];
  resultCount: number;
};

/** Press coverage filters — sticky on mobile via shared marketing toolbar. */
export function PressPageToolbar({ params, years, resultCount }: PressPageToolbarProps) {
  const resultCountLabel = formatPressApplyButtonLabel(resultCount);
  const activeCount = countActivePressHubFilters(params);
  const hasActiveFilters = activeCount > 0;

  return (
    <MarketingListToolbar
      className={cn(
        "lg:static lg:z-auto lg:border-b-0 lg:bg-transparent lg:backdrop-blur-none",
        "-mx-8 md:-mx-10 lg:mx-0",
        MARKETING_PAGE_GUTTER_X,
        "lg:px-0",
      )}
      mobileFilterTrigger={
        <PressFilterSheet
          activeCount={activeCount}
          initialParams={params}
          years={years}
          resultCount={resultCount}
          resultCountLabel={resultCountLabel}
        />
      }
      filters={
        <PressFilterForm
          initialParams={params}
          years={years}
          resultCount={resultCount}
          className="w-full"
        />
      }
      trailing={
        <Link
          href="/press/feed.xml"
          className={cn(
            "inline-flex min-h-11 items-center gap-1.5 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-secondary hover:underline",
            FOCUS_RING,
          )}
        >
          <Rss className="size-3.5 shrink-0" aria-hidden />
          RSS
        </Link>
      }
      activeFiltersRow={hasActiveFilters ? <PressActiveFilters params={params} /> : null}
    />
  );
}
