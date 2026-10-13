"use client";

import {
  type ArtworkCatalogueDraft,
  ArtworkCatalogueFilterBody,
  type CatalogueFilterOption,
  artworkDraftFromState,
  draftToPartialState,
} from "@/components/catalogue/artwork-catalogue-filter-body";
import { ARTWORK_SORT_OPTIONS } from "@/lib/catalogue/artwork-catalogue-filter-config";
import {
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
import {
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_MAIN_COLUMN,
  MARKETING_LIST_TOOLBAR_BLEED,
} from "@auction/branding";
import {
  CatalogActiveFilterChips,
  type CatalogLayoutView,
  MARKETING_FILTER_RAIL_IN_SHEET,
  MARKETING_FILTER_RAIL_STICKY,
  MarketingCatalogViewSwitcher,
  MarketingFilterSheet,
  MarketingFilterTrigger,
  MarketingListToolbar,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Input } from "@auction/ui/components/input";
import { Label } from "@auction/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@auction/ui/components/select";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
  useTransition,
} from "react";

type Props = {
  state: ArtworkCatalogueUrlState;
  resultCount: number;
  categories: CatalogueFilterOption[];
  artists: CatalogueFilterOption[];
  /** Server-resolved layout; the switcher keeps it in sync with `?view=`. */
  view: CatalogLayoutView;
  children: ReactNode;
};

/** Cursor pagination survives a layout switch — the page itself does not change. */
const KEEP_CURSOR: readonly string[] = [];

export function ArtworkCatalogueBrowse({
  state,
  resultCount,
  categories,
  artists,
  view,
  children,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(() => artworkDraftFromState(state));
  const [searchDraft, setSearchDraft] = useState(state.q ?? "");

  useEffect(() => {
    setDraft(artworkDraftFromState(state));
    setSearchDraft(state.q ?? "");
  }, [state]);

  const navigate = useCallback(
    (href: string) => {
      startTransition(() => {
        router.push(href);
      });
    },
    [router],
  );

  const countLabel = `${resultCount} artwork${resultCount === 1 ? "" : "s"}`;
  const applyLabel = "Apply filters";
  const activeCount = countActiveArtworkCatalogueFilters(state);
  const chips = buildArtworkCatalogueActiveChips(state, { categories, artists });

  function applyDraft(next: ArtworkCatalogueDraft) {
    setDraft(next);
    navigate(artworkCatalogueFilterHref(state, draftToPartialState(next)));
  }

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    navigate(
      artworkCatalogueFilterHref(state, {
        q: searchDraft.trim() ? searchDraft.trim() : null,
      }),
    );
  }

  const sortControl = (
    <Select
      value={state.sort}
      disabled={pending}
      onValueChange={(value) =>
        navigate(
          artworkCatalogueFilterHref(state, { sort: value as ArtworkCatalogueUrlState["sort"] }),
        )
      }
    >
      <SelectTrigger
        aria-label="Sort artworks"
        data-testid="art-catalogue-sort"
        className="min-h-11 w-[11rem] rounded-full border-outline-variant/50 bg-surface-container-lowest"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ARTWORK_SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const searchControl = (
    <form className="hidden min-w-0 flex-1 lg:flex" onSubmit={onSearchSubmit}>
      <Input
        type="search"
        aria-label="Search title or artist"
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        placeholder="Search title or artist"
        className="min-h-11 w-full max-w-md rounded-full"
      />
    </form>
  );

  return (
    <div className="relative flex w-full flex-col gap-6">
      <div className={cn(MARKETING_LIST_TOOLBAR_BLEED, "-mt-2")}>
        <MarketingListToolbar
          countLabel={countLabel}
          sort={sortControl}
          filters={searchControl}
          stackTrailingOnMobile
          trailing={
            <MarketingCatalogViewSwitcher
              routeKey={ART_ARTWORKS_VIEW_ROUTE_KEY}
              value={view}
              modes={ART_CATALOGUE_VIEW_MODES}
              clearParams={KEEP_CURSOR}
            />
          }
          mobileFilterTrigger={
            <MarketingFilterSheet
              open={sheetOpen}
              onOpenChange={setSheetOpen}
              title="Filters"
              trigger={<MarketingFilterTrigger activeCount={activeCount} />}
              applyLabel={applyLabel}
              onApply={() => {
                navigate(artworkCatalogueFilterHref(state, draftToPartialState(draft)));
                setSheetOpen(false);
              }}
              onReset={() => {
                navigate(artworkCatalogueClearHref());
                setSheetOpen(false);
              }}
            >
              <div className="mb-4 flex flex-col gap-1 lg:hidden">
                <Label htmlFor="art-sheet-search" className="font-body text-sm">
                  Search
                </Label>
                <Input
                  id="art-sheet-search"
                  type="search"
                  value={draft.q}
                  onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                  placeholder="Search title or artist"
                  className="min-h-11"
                />
              </div>
              <ArtworkCatalogueFilterBody
                idPrefix="art-sheet"
                draft={draft}
                onDraftChange={setDraft}
                categories={categories}
                artists={artists}
                showResultCount={false}
                className={MARKETING_FILTER_RAIL_IN_SHEET}
              />
            </MarketingFilterSheet>
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

      <div className={MARKETING_CATALOG_FILTER_GRID}>
        <div className={MARKETING_CATALOG_FILTER_RAIL_SLOT}>
          <ArtworkCatalogueFilterBody
            idPrefix="art-rail"
            draft={draft}
            onDraftChange={setDraft}
            onFilterCommit={applyDraft}
            categories={categories}
            artists={artists}
            showResultCount={false}
            className={MARKETING_FILTER_RAIL_STICKY}
          />
        </div>
        <div className={cn(MARKETING_CATALOG_MAIN_COLUMN, pending && "opacity-70")}>{children}</div>
      </div>
    </div>
  );
}
