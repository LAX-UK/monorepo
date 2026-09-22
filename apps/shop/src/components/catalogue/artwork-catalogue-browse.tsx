"use client";

import {
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
  MARKETING_CATALOG_FILTER_GRID,
  MARKETING_CATALOG_FILTER_RAIL_SLOT,
  MARKETING_CATALOG_MAIN_COLUMN,
  MARKETING_LIST_TOOLBAR_BLEED,
} from "@auction/branding";
import {
  CatalogActiveFilterChips,
  MARKETING_FILTER_RAIL_IN_SHEET,
  MARKETING_FILTER_RAIL_STICKY,
  MarketingFilterSheet,
  MarketingFilterTrigger,
  MarketingListToolbar,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
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
  children: ReactNode;
};

export function ArtworkCatalogueBrowse({
  state,
  resultCount,
  categories,
  artists,
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
  const applyLabel = resultCount === 1 ? "Show 1 artwork" : `Show ${resultCount} artworks`;
  const activeCount = countActiveArtworkCatalogueFilters(state);
  const chips = buildArtworkCatalogueActiveChips(state, { categories, artists });

  function onSearchSubmit(event: FormEvent) {
    event.preventDefault();
    navigate(
      artworkCatalogueFilterHref(state, {
        q: searchDraft.trim() ? searchDraft.trim() : null,
      }),
    );
  }

  const sortControl = (
    <label className="flex items-center gap-2 font-label text-[0.65rem] font-semibold uppercase tracking-wider text-on-surface-variant">
      <span className="sr-only">Sort artworks</span>
      <select
        className="min-h-11 max-w-[11rem] rounded-full border border-outline-variant/50 bg-surface-container-lowest px-3 font-body text-sm normal-case text-on-surface"
        value={state.sort}
        disabled={pending}
        onChange={(event) =>
          navigate(
            artworkCatalogueFilterHref(state, {
              sort: event.target.value as ArtworkCatalogueUrlState["sort"],
            }),
          )
        }
      >
        {ARTWORK_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const searchControl = (
    <form className="hidden min-w-0 flex-1 lg:flex" onSubmit={onSearchSubmit}>
      <input
        type="search"
        value={searchDraft}
        onChange={(event) => setSearchDraft(event.target.value)}
        placeholder="Search title or artist"
        className="min-h-11 w-full max-w-md rounded-full border border-outline-variant/50 bg-surface-container-lowest px-4 font-body text-sm"
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
              <ArtworkCatalogueFilterBody
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
            draft={draft}
            onDraftChange={(next) => {
              setDraft(next);
              navigate(artworkCatalogueFilterHref(state, draftToPartialState(next)));
            }}
            categories={categories}
            artists={artists}
            resultCount={resultCount}
            className={MARKETING_FILTER_RAIL_STICKY}
          />
        </div>
        <div className={cn(MARKETING_CATALOG_MAIN_COLUMN, pending && "opacity-70")}>{children}</div>
      </div>
    </div>
  );
}
