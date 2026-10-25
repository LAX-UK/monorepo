import { CatalogueGrid } from "@/components/catalogue-grid";
import { CatalogueList } from "@/components/catalogue-list";
import { ArtworkCatalogueBrowse } from "@/components/catalogue/artwork-catalogue-browse";
import {
  ShopCatalogueHub,
  ShopCataloguePagerLink,
} from "@/components/catalogue/shop-catalogue-hub";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  artworkCatalogueClearHref,
  artworkCatalogueFetchQuery,
  artworkCatalogueHasActiveFilters,
  artworkCataloguePagerHref,
  parseArtworkCatalogueParams,
} from "@/lib/catalogue/artwork-catalogue-params";
import { buildCatalogueFilterOptions } from "@/lib/catalogue/catalogue-filter-options";
import { SHOP_ARTWORKS_VIEW_ROUTE_KEY } from "@/lib/catalogue/catalogue-view";
import { resolveShopCatalogueView } from "@/lib/catalogue/catalogue-view.server";
import {
  fetchPublicArtists,
  fetchPublicArtworkFacets,
  fetchPublicArtworks,
  fetchPublicCategories,
} from "@/lib/shop-api.server";
import { MarketingCatalogView } from "@auction/marketing-ui";
import type { Metadata } from "next";

const CATALOGUE_TITLE = "Artworks";
const CATALOGUE_DESCRIPTION = "Limited-edition prints by LAX artists, delivered across the UK.";

type ArtworksIndexPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ArtworksIndexPageProps): Promise<Metadata> {
  const state = parseArtworkCatalogueParams(await searchParams);
  const description = state.q
    ? `Search results for “${state.q}” in the LAX Shop catalogue.`
    : CATALOGUE_DESCRIPTION;
  return {
    title: `${CATALOGUE_TITLE} | LAX Shop`,
    description,
    alternates: { canonical: "/artworks" },
  };
}

export default async function ArtworksIndexPage({ searchParams }: ArtworksIndexPageProps) {
  const query = await searchParams;
  const state = parseArtworkCatalogueParams(query);
  const fetchQuery = artworkCatalogueFetchQuery(state);
  const filterQuery = {
    ...(fetchQuery.q ? { q: fetchQuery.q } : {}),
    ...(fetchQuery.categorySlug ? { categorySlug: fetchQuery.categorySlug } : {}),
    ...(fetchQuery.artistSlug ? { artistSlug: fetchQuery.artistSlug } : {}),
    ...(fetchQuery.availability ? { availability: fetchQuery.availability } : {}),
    ...(fetchQuery.minPrice !== undefined ? { minPrice: fetchQuery.minPrice } : {}),
    ...(fetchQuery.maxPrice !== undefined ? { maxPrice: fetchQuery.maxPrice } : {}),
  };
  const [catalogue, categoryList, artistList, facets, view] = await Promise.all([
    fetchPublicArtworks({
      limit: 24,
      ...(fetchQuery.cursor ? { cursor: fetchQuery.cursor } : {}),
      ...filterQuery,
      ...(fetchQuery.sort ? { sort: fetchQuery.sort } : {}),
    }),
    fetchPublicCategories({ limit: 50 }),
    fetchPublicArtists({ limit: 50 }),
    // Counts are a help, not a requirement: without them the options still work.
    fetchPublicArtworkFacets(filterQuery).catch(() => null),
    resolveShopCatalogueView(SHOP_ARTWORKS_VIEW_ROUTE_KEY, query.view),
  ]);
  const { items, nextCursor, totalCount } = catalogue;
  const resultCount = totalCount ?? items.length;
  const categories = buildCatalogueFilterOptions(
    categoryList.items.map((item) => ({ slug: item.slug, label: item.label })),
    facets?.categories.map((item) => ({ slug: item.slug, label: item.label, count: item.count })),
  );
  const artists = buildCatalogueFilterOptions(
    artistList.items.map((item) => ({ slug: item.slug, label: item.name })),
    facets?.artists.map((item) => ({ slug: item.slug, label: item.name, count: item.count })),
  );

  const description = state.q
    ? `Search results for “${state.q}” in the LAX Shop catalogue.`
    : CATALOGUE_DESCRIPTION;

  const showPrevious = Boolean(state.cursor);
  const previousHref = showPrevious
    ? state.back
      ? artworkCataloguePagerHref(state, { cursor: state.back, back: null })
      : artworkCataloguePagerHref(state, { cursor: null, back: null })
    : null;

  const filteredEmpty = items.length === 0 && artworkCatalogueHasActiveFilters(state);
  // A search or filter with no results still leads somewhere: editions on sale now.
  const suggestions = filteredEmpty
    ? await fetchPublicArtworks({ limit: 4, availability: "available" })
        .then((list) => list.items)
        .catch(() => [])
    : [];

  // Only paged results need a pager; when every edition is on the page the count says it all.
  const pager =
    previousHref || nextCursor ? (
      <nav aria-label="Catalogue pages" className="shop-catalogue-pager">
        <p className="shop-catalogue-pager__status">
          Showing {items.length} {items.length === 1 ? "edition" : "editions"} on this page
          {totalCount !== undefined ? ` of ${totalCount}` : ""}
        </p>
        <div className="shop-catalogue-pager__links">
          {previousHref ? (
            <ShopCataloguePagerLink href={previousHref}>Previous editions</ShopCataloguePagerLink>
          ) : null}
          {nextCursor ? (
            <ShopCataloguePagerLink
              href={artworkCataloguePagerHref(state, {
                cursor: nextCursor,
                back: state.cursor ?? "",
              })}
            >
              Next editions
            </ShopCataloguePagerLink>
          ) : null}
        </div>
      </nav>
    ) : null;

  return (
    <ShopCatalogueHub title={CATALOGUE_TITLE} description={description}>
      <ArtworkCatalogueBrowse
        state={state}
        resultCount={resultCount}
        categories={categories}
        artists={artists}
        availabilityCounts={facets?.availability ?? null}
        view={view}
      >
        {items.length === 0 ? (
          <div className="shop-catalogue-empty">
            <ShopStatusState
              variant="empty"
              icon="search"
              titleAs="h2"
              title={
                filteredEmpty
                  ? state.q
                    ? `No editions match “${state.q}”`
                    : "No editions match these filters"
                  : "No editions yet"
              }
              description={
                filteredEmpty
                  ? "Check the spelling, or remove a filter. The editions below are on sale now."
                  : "New limited editions appear here as soon as they go on sale."
              }
              actions={
                filteredEmpty ? (
                  <>
                    <ShopStatusStateLink href={artworkCatalogueClearHref()} priority="primary">
                      Clear filters
                    </ShopStatusStateLink>
                    <ShopStatusStateLink href="/artists">Browse artists</ShopStatusStateLink>
                  </>
                ) : (
                  <ShopStatusStateLink href="/artists">Browse artists</ShopStatusStateLink>
                )
              }
            />
            {suggestions.length > 0 ? (
              <section
                aria-labelledby="catalogue-suggestions"
                className="shop-catalogue-empty__more"
              >
                <h2 id="catalogue-suggestions" className="shop-catalogue-empty__heading">
                  On sale now
                </h2>
                <CatalogueGrid items={suggestions} titleLevel={3} />
              </section>
            ) : null}
          </div>
        ) : (
          <>
            <MarketingCatalogView
              value={view}
              grid={<CatalogueGrid items={items} />}
              list={<CatalogueList items={items} />}
            />
            {pager}
          </>
        )}
      </ArtworkCatalogueBrowse>
    </ShopCatalogueHub>
  );
}
