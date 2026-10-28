import { Button } from "@auction/ui/components/button";
import Link from "next/link";
import type { ReactNode } from "react";
import { CatalogActiveFilterChips } from "./catalog-active-filter-chips.js";
import { MarketingAlphabetFilter } from "./marketing-alphabet-filter.js";
import {
  type MarketingArtistDirectoryQuery,
  marketingArtistDirectoryControls,
  marketingArtistDirectoryHref,
} from "./marketing-artist-directory-query.js";
import {
  MarketingDirectory,
  MarketingDirectoryHeader,
  MarketingDirectorySearch,
} from "./marketing-directory.js";
import { MarketingFilterLinkGroups } from "./marketing-filter-link-groups.js";
import { MarketingLinkFilterSheet } from "./marketing-link-filter-sheet.js";
import { MarketingListToolbar } from "./marketing-list-toolbar.js";
import { MarketingSortLinks } from "./marketing-sort-links.js";

export function marketingArtistCountLabel(count: number): string {
  return `${count} ${count === 1 ? "artist" : "artists"}`;
}

export type MarketingArtistDirectoryProps = {
  basePath: string;
  title: string;
  description?: ReactNode;
  query: MarketingArtistDirectoryQuery;
  /** Artists matching the filters across all pages, when known. */
  total: number | null;
  /** Artists on this page. */
  pageCount: number;
  /** Cursor for the next page, when there is one. */
  nextCursor?: string | undefined;
  /** Grid, or the empty or error state. */
  children: ReactNode;
  as?: "main" | "div";
  jsonLd?: ReactNode;
};

/**
 * Artist directory for LAX Shop and lax.art, laid out like LAX Bid's: title band with search and
 * the A–Z bar, a filter rail on desktop, a filter sheet on phones, the result count, sort and
 * removable filter chips. Everything is a link, so it works without JavaScript.
 */
export function MarketingArtistDirectory({
  basePath,
  title,
  description,
  query,
  total,
  pageCount,
  nextCursor,
  children,
  as = "div",
  jsonLd,
}: MarketingArtistDirectoryProps) {
  const controls = marketingArtistDirectoryControls(basePath, query);
  const countLabel = marketingArtistCountLabel(total ?? pageCount);
  const hasFilters = controls.activeCount > 0;

  return (
    <MarketingDirectory
      as={as}
      jsonLd={jsonLd}
      railLabel="Artist filters"
      header={
        <MarketingDirectoryHeader
          title={title}
          description={description}
          search={
            <MarketingDirectorySearch
              action={basePath}
              label="Search artists"
              placeholder="Artist name"
              defaultValue={query.q}
              hidden={{ show: query.show, sort: query.sort }}
            />
          }
          letterBar={
            <MarketingAlphabetFilter
              basePath={basePath}
              active={query.letter}
              hrefFor={(letter) =>
                marketingArtistDirectoryHref(basePath, query, { letter: letter ?? null })
              }
              ariaLabel="Jump to letter"
            />
          }
        />
      }
      rail={
        <MarketingFilterLinkGroups
          groups={controls.railGroups}
          clearHref={controls.clearHref}
          hasFilters={hasFilters}
          idPrefix="rail"
        />
      }
      toolbar={
        <MarketingListToolbar
          className="rounded-none border-x-0"
          gutter={false}
          countLabel={countLabel}
          mobileFilterTrigger={
            <MarketingLinkFilterSheet
              activeCount={controls.activeCount}
              resultLabel={`Show ${countLabel}`}
              resetHref={controls.clearHref}
            >
              <MarketingFilterLinkGroups
                groups={[
                  ...controls.railGroups,
                  { id: "sort", title: "Sort by", links: controls.sortLinks },
                ]}
                clearHref={controls.clearHref}
                hasFilters={hasFilters}
                idPrefix="sheet"
              />
            </MarketingLinkFilterSheet>
          }
          sort={<MarketingSortLinks options={controls.sortLinks} className="hidden md:flex" />}
        />
      }
      activeFilters={
        <CatalogActiveFilterChips
          chips={controls.activeChips}
          {...(hasFilters ? { clearHref: controls.clearHref } : {})}
          className="mb-0 md:mb-0"
        />
      }
      footer={
        query.cursor || nextCursor ? (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-3 pt-4">
            {query.cursor ? (
              <Button asChild variant="secondaryOutline">
                <Link href={marketingArtistDirectoryHref(basePath, query)}>First page</Link>
              </Button>
            ) : null}
            {nextCursor ? (
              <Button asChild variant="secondaryOutline">
                <Link href={marketingArtistDirectoryHref(basePath, query, { cursor: nextCursor })}>
                  Next page
                </Link>
              </Button>
            ) : null}
          </nav>
        ) : null
      }
    >
      {children}
    </MarketingDirectory>
  );
}
