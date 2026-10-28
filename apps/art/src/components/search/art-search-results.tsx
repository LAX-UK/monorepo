import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtEditorialCardGrid } from "@/components/editorial/art-editorial-card";
import { ArtSearchFilters } from "@/components/search/art-search-filters.client";
import { ArtSearchSort } from "@/components/search/art-search-sort.client";
import type { SearchPanelVm, SearchResultsVm } from "@/lib/search/search-page.composer";
import { isArtworkTab, searchEmptyCopy, searchResultCountLabel } from "@/lib/search/search-page.vm";
import { searchClearFiltersHref } from "@/lib/search/search-params";
import { MarketingViewAllChevron } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import { SectionTabs } from "@auction/ui/components/section-tabs";
import Link from "next/link";

function panelCount(panel: SearchPanelVm): number | null {
  return panel.kind === "unavailable" ? null : panel.count;
}

function SearchPanel({ vm }: { vm: SearchResultsVm }) {
  const { panel, activeTab } = vm;
  if (panel.kind === "unavailable") {
    return (
      <ArtStatusState
        variant="error"
        title="These results are unavailable"
        description="We could not load this part of the search. Try again shortly."
      />
    );
  }
  if (panel.cards.length === 0) {
    const filtered = vm.activeFilterCount > 0;
    const copy = searchEmptyCopy(activeTab, filtered);
    return (
      <div data-testid="art-search-tab-empty">
        <ArtStatusState
          variant="empty"
          icon="search-remove"
          title={copy.title}
          description={copy.description}
          actions={
            filtered ? (
              <ArtStatusStateLink href={searchClearFiltersHref(vm.state)}>
                Clear filters
              </ArtStatusStateLink>
            ) : (
              <ArtStatusStateLink href="/artworks">Browse all artworks</ArtStatusStateLink>
            )
          }
        />
      </div>
    );
  }
  if (panel.kind === "artworks") {
    return (
      <div className="flex flex-col gap-10">
        <ArtArtworkGrid
          cards={panel.cards}
          favoriteAuth={vm.favoriteAuth}
          priorityCount={2}
          aria-label="Artworks"
        />
        {panel.nextPageHref ? (
          <nav aria-label="Pagination" className="flex justify-center">
            <Button asChild variant="outline" className="min-h-11 font-label">
              <Link href={panel.nextPageHref}>Next page</Link>
            </Button>
          </nav>
        ) : null}
      </div>
    );
  }
  return (
    <ArtEditorialCardGrid
      cards={panel.cards}
      ariaLabel={activeTab === "exhibitions" ? "Exhibitions" : "Articles"}
    />
  );
}

/** Nothing matched anywhere: say so once, with places to look next, instead of empty tabs. */
function SearchNoResults({ query }: { query: string }) {
  return (
    <div data-testid="art-search-no-results">
      <ArtStatusState
        variant="empty"
        icon="search-remove"
        layout="page"
        titleAs="h1"
        title={`No results for “${query}”`}
        description="Check the spelling, or look through the gallery instead."
        actions={
          <>
            <ArtStatusStateLink href="/artworks" priority="primary">
              Browse artworks
            </ArtStatusStateLink>
            <ArtStatusStateLink href="/artists">Artists</ArtStatusStateLink>
            <ArtStatusStateLink href="/exhibitions">Exhibitions</ArtStatusStateLink>
          </>
        }
      />
    </div>
  );
}

/** Results layout from Figma `826:14746`: title, Filters + tabs row, count and sort, panel. */
export function ArtSearchResults({ vm }: { vm: SearchResultsVm }) {
  if (vm.noResults) return <SearchNoResults query={vm.query} />;
  const artworkTab = isArtworkTab(vm.activeTab);
  const showFilters = artworkTab;
  const count = panelCount(vm.panel);

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <h1 className="text-balance text-center font-headline text-[length:var(--text-title-section)] font-medium leading-tight text-on-surface">
        Showing results for “<strong className="font-bold">{vm.query}</strong>”
      </h1>

      {vm.artistLink ? (
        <Link
          href={vm.artistLink.href}
          className="art-focus-ring inline-flex min-h-11 items-center gap-1 self-start font-body text-sm text-on-surface underline-offset-4 hover:underline"
          data-testid="art-search-artist-link"
        >
          Artist: <span className="font-semibold">{vm.artistLink.name}</span>
          <MarketingViewAllChevron className="size-4" />
        </Link>
      ) : null}

      <div className="flex flex-col gap-6">
        <div className="flex min-w-0 items-stretch border-b border-outline-variant">
          {showFilters ? (
            <div className="mr-4 flex shrink-0 items-center border-r border-on-surface pr-4 sm:mr-8 sm:pr-6">
              <ArtSearchFilters state={vm.state} activeCount={vm.activeFilterCount} />
            </div>
          ) : null}
          <SectionTabs
            ariaLabel="Search results"
            active={vm.activeTab}
            items={vm.tabs}
            className="min-w-0 flex-nowrap gap-6 overflow-x-auto border-b-0 sm:gap-10"
          />
        </div>

        {count !== null ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <p
              className="font-body text-sm font-medium text-on-surface"
              aria-live="polite"
              data-testid="art-search-count"
            >
              {searchResultCountLabel(count)}
            </p>
            {artworkTab && count > 0 ? <ArtSearchSort state={vm.state} /> : null}
          </div>
        ) : null}

        <section aria-label="Results">
          <SearchPanel vm={vm} />
        </section>
      </div>
    </div>
  );
}
