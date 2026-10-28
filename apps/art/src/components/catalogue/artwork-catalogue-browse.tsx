"use client";

import {
  ArtworkCatalogueFilterBody,
  type CatalogueFilterOption,
} from "@/components/catalogue/artwork-catalogue-filter-body";
import {
  type ArtworkCatalogueDraft,
  EMPTY_ARTWORK_CATALOGUE_DRAFT,
  artworkDraftFromState,
  artworkDraftToPatch,
} from "@/lib/catalogue/artwork-catalogue-draft";
import {
  ARTWORK_PRICE_BAND_OPTIONS,
  type ArtworkFilterOption,
  artworkPriceBandPatch,
  artworkPriceBandValue,
} from "@/lib/catalogue/artwork-catalogue-filter-config";
import {
  type ArtworkCatalogueFilterPatch,
  type ArtworkCatalogueUrlState,
  artworkCatalogueClearHref,
  artworkCatalogueFilterHref,
  buildArtworkCatalogueActiveChips,
  countActiveArtworkCatalogueFilters,
} from "@/lib/catalogue/artwork-catalogue-params";
import {
  ART_ARTWORKS_VIEW_ROUTE_KEY,
  ART_CATALOGUE_VIEW_MODES,
} from "@/lib/catalogue/catalogue-view";
import { MARKETING_LIST_TOOLBAR_BLEED } from "@auction/branding";
import {
  CatalogActiveFilterChips,
  type CatalogLayoutView,
  MarketingCatalogViewSwitcher,
  MarketingFilterDropdown,
  MarketingFilterTrigger,
  MarketingListToolbar,
  SplitFilterSheet,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useState, useTransition } from "react";

type Props = {
  state: ArtworkCatalogueUrlState;
  resultCount: number;
  categories: CatalogueFilterOption[];
  artists: CatalogueFilterOption[];
  mediumOptions: ArtworkFilterOption[];
  /** Server-resolved layout; the switcher keeps it in sync with `?view=`. */
  view: CatalogLayoutView;
  children: ReactNode;
};

/** Cursor pagination survives a layout switch — the page itself does not change. */
const KEEP_CURSOR: readonly string[] = [];

/**
 * Figma 538:4885 browse pattern: Filters opens a drawer on every breakpoint, and the toolbar
 * carries Medium and Price range dropdowns from `lg`. The URL is the only applied state;
 * every apply builds a new href, which also drops the pagination cursor.
 */
export function ArtworkCatalogueBrowse({
  state,
  resultCount,
  categories,
  artists,
  mediumOptions,
  view,
  children,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState<ArtworkCatalogueDraft>(() => artworkDraftFromState(state));

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  function applyPatch(patch: ArtworkCatalogueFilterPatch) {
    navigate(artworkCatalogueFilterHref(state, patch));
  }

  // Opening always starts from the applied URL state, so a cancelled draft never lingers.
  function handleSheetOpenChange(open: boolean) {
    if (open) setDraft(artworkDraftFromState(state));
    setSheetOpen(open);
  }

  const activeCount = countActiveArtworkCatalogueFilters(state);
  const chips = buildArtworkCatalogueActiveChips(state, { categories, artists });
  const priceBand = artworkPriceBandValue(state);
  const openSheet = () => handleSheetOpenChange(true);

  const desktopFilters = (
    <div className="flex min-w-0 items-center">
      <MarketingFilterTrigger activeCount={activeCount} onClick={openSheet} />
      <span aria-hidden className="mx-4 h-6 w-px shrink-0 bg-outline-variant" />
      <MarketingFilterDropdown
        label="Medium"
        idPrefix="art-toolbar-medium"
        options={mediumOptions}
        selected={state.objectTypes}
        onApply={(values) =>
          applyPatch({ objectTypes: values as ArtworkCatalogueUrlState["objectTypes"] })
        }
      />
      <MarketingFilterDropdown
        label="Price range"
        idPrefix="art-toolbar-price"
        selection="single"
        options={ARTWORK_PRICE_BAND_OPTIONS}
        selected={priceBand ? [priceBand] : []}
        onApply={([band = ""]) => applyPatch(artworkPriceBandPatch(band))}
      />
    </div>
  );

  return (
    <div className="relative flex w-full flex-col gap-6">
      <div className={cn(MARKETING_LIST_TOOLBAR_BLEED, "-mt-2")}>
        <MarketingListToolbar
          countLabel={`${resultCount} available`}
          countMobileOnly
          filters={desktopFilters}
          mobileFilterTrigger={
            <MarketingFilterTrigger activeCount={activeCount} onClick={openSheet} />
          }
          trailing={
            <MarketingCatalogViewSwitcher
              routeKey={ART_ARTWORKS_VIEW_ROUTE_KEY}
              value={view}
              modes={ART_CATALOGUE_VIEW_MODES}
              clearParams={KEEP_CURSOR}
            />
          }
          activeFiltersRow={
            chips.length > 0 ? (
              <CatalogActiveFilterChips
                chips={chips}
                clearHref={artworkCatalogueClearHref()}
                pending={pending}
                onNavigate={navigate}
              />
            ) : null
          }
        />
      </div>

      <SplitFilterSheet
        variant="catalogue"
        open={sheetOpen}
        onOpenChange={handleSheetOpenChange}
        title="Filters"
        description="Choose filters, then apply them to update the artworks."
        applyLabel="Apply"
        mobileApplyLabel="Show results"
        onApply={() => {
          applyPatch(artworkDraftToPatch(draft));
          setSheetOpen(false);
        }}
        resetLabel="Reset all"
        onReset={() => setDraft(EMPTY_ARTWORK_CATALOGUE_DRAFT)}
      >
        <ArtworkCatalogueFilterBody
          draft={draft}
          onDraftChange={setDraft}
          categories={categories}
          artists={artists}
          mediumOptions={mediumOptions}
        />
      </SplitFilterSheet>

      <div className={cn("min-w-0", pending && "opacity-70")}>{children}</div>
    </div>
  );
}
