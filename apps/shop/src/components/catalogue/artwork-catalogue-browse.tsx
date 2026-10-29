"use client";

import { ArtworkCatalogueFilterBody } from "@/components/catalogue/artwork-catalogue-filter-body";
import type { CatalogActiveFilterChip } from "@/lib/catalogue/artwork-catalogue-params";
import type { CatalogueFilterRailVm } from "@/lib/catalogue/catalogue-filter-groups";
import type { CatalogueQuickChipVm } from "@/lib/catalogue/catalogue-quick-chips";
import type { CatalogueSortVm } from "@/lib/catalogue/catalogue-sort";
import {
  SHOP_ARTWORKS_VIEW_ROUTE_KEY,
  SHOP_CATALOGUE_VIEW_MODES,
} from "@/lib/catalogue/catalogue-view";
import {
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_MAIN_COLUMN,
} from "@auction/branding";
import {
  CatalogActiveFilterChips,
  CatalogFilterLiveRegion,
  type CatalogLayoutView,
  MARKETING_FILTER_RAIL_IN_SHEET,
  MARKETING_FILTER_RAIL_STICKY,
  MarketingCatalogViewSwitcher,
  MarketingChipStrip,
  MarketingFilterChip,
  MarketingFilterDropdown,
  MarketingFilterSheet,
  MarketingFilterTrigger,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState, useTransition } from "react";

type Props = {
  rail: CatalogueFilterRailVm;
  quickChips: readonly CatalogueQuickChipVm[];
  activeChips: CatalogActiveFilterChip[];
  activeCount: number;
  sort: CatalogueSortVm;
  clearHref: string;
  /** "3 editions": announced as filters change, and on the sheet's button. */
  resultLabel: string;
  /** Server-resolved layout; the switcher keeps it in sync with `?view=`. */
  view: CatalogLayoutView;
  /** Leave the view switch out, e.g. when there is nothing to lay out. */
  showViewSwitch?: boolean;
  children: ReactNode;
};

const COUNT_NOUN = { one: "edition", other: "editions" };

/** The view switch keeps the list's length; only filter and sort changes start again. */
const KEEP_PARAMS: readonly string[] = [];

/**
 * The catalogue's controls around its results: the filter rail on the left from `lg`, the quick
 * chips, sort and view above the results, the applied chips under them, and on phones one
 * "Filter and sort" sheet. Every choice is a link the server rendered, applied at once, so the
 * counts, the results and the sheet's "Show N editions" are always the server's own.
 */
export function ArtworkCatalogueBrowse({
  rail,
  quickChips,
  activeChips,
  activeCount,
  sort,
  clearHref,
  resultLabel,
  view,
  showViewSwitch = true,
  children,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href, { scroll: false });
      });
    },
    [router],
  );

  const sortControl = (
    <MarketingFilterDropdown
      label="Sort"
      triggerLabel={`Sort: ${sort.current.label}`}
      idPrefix="shop-catalogue-sort"
      selection="single"
      options={sort.options.map(({ value, label }) => ({ value, label }))}
      selected={[sort.current.value]}
      onApply={([value]) => {
        const chosen = sort.options.find((option) => option.value === value);
        if (chosen && chosen.value !== sort.current.value) navigate(chosen.href);
      }}
      className="shop-catalogue-sort"
    />
  );

  // With nothing to filter, the results take the full width instead of sitting beside a gap.
  const hasRail = rail.groups.length > 0 || rail.availability !== null;

  return (
    <div className={hasRail ? MARKETING_CATALOG_FILTER_GRID : undefined}>
      <CatalogFilterLiveRegion message={resultLabel} />
      {hasRail ? (
        <div className={MARKETING_CATALOG_FILTER_RAIL_SLOT}>
          <ArtworkCatalogueFilterBody
            rail={rail}
            onNavigate={navigate}
            pending={pending}
            className={MARKETING_FILTER_RAIL_STICKY}
          />
        </div>
      ) : null}

      <div className={cn(MARKETING_CATALOG_MAIN_COLUMN, "shop-catalogue-main")}>
        <div className="shop-catalogue-toolbar">
          <div className="shop-catalogue-toolbar__chips">
            <MarketingChipStrip wrapOnDesktop className="relative">
              <div className="shrink-0 snap-start lg:hidden">
                <MarketingFilterSheet
                  variant="catalogue"
                  open={sheetOpen}
                  onOpenChange={setSheetOpen}
                  title="Filter and sort"
                  description="Each choice updates the editions at once."
                  trigger={
                    <MarketingFilterTrigger
                      label="Filter and sort"
                      activeCount={activeCount}
                      className="gap-2 border-input-border bg-transparent px-4 font-body text-sm font-medium tracking-normal"
                    />
                  }
                  applyLabel={`Show ${resultLabel}`}
                  onApply={() => setSheetOpen(false)}
                  resetLabel="Clear"
                  onReset={() => navigate(clearHref)}
                  className="h-[100dvh] max-h-[100dvh] rounded-t-none"
                >
                  <ArtworkCatalogueFilterBody
                    rail={rail}
                    sort={sort}
                    onNavigate={navigate}
                    pending={pending}
                    className={MARKETING_FILTER_RAIL_IN_SHEET}
                  />
                </MarketingFilterSheet>
              </div>
              {quickChips.map((chip) => (
                <MarketingFilterChip
                  key={chip.key}
                  label={chip.label}
                  count={chip.count}
                  countNoun={COUNT_NOUN}
                  active={chip.active}
                  disabled={pending}
                  onClick={() => navigate(chip.href)}
                />
              ))}
            </MarketingChipStrip>
          </div>
          <div className="shop-catalogue-toolbar__end">
            <div className="hidden lg:block">{sortControl}</div>
            {showViewSwitch ? (
              <MarketingCatalogViewSwitcher
                routeKey={SHOP_ARTWORKS_VIEW_ROUTE_KEY}
                value={view}
                modes={SHOP_CATALOGUE_VIEW_MODES}
                clearParams={KEEP_PARAMS}
              />
            ) : null}
          </div>
        </div>
        {activeChips.length > 0 ? (
          <CatalogActiveFilterChips
            chips={activeChips}
            clearHref={clearHref}
            pending={pending}
            onNavigate={navigate}
            className="shop-catalogue-applied"
          />
        ) : null}
        <div
          className={cn(
            "shop-catalogue-main__results",
            pending && "shop-catalogue-main__results--pending",
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
