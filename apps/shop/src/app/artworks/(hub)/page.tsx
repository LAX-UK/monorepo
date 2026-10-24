import { CatalogueGrid } from "@/components/catalogue-grid";
import { CatalogueList } from "@/components/catalogue-list";
import { ArtworkCatalogueBrowse } from "@/components/catalogue/artwork-catalogue-browse";
import {
  ShopCatalogueHub,
  ShopCataloguePagerLink,
} from "@/components/catalogue/shop-catalogue-hub";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  artworkCatalogueFetchQuery,
  artworkCatalogueHasActiveFilters,
  artworkCataloguePagerHref,
  parseArtworkCatalogueParams,
} from "@/lib/catalogue/artwork-catalogue-params";
import { SHOP_ARTWORKS_VIEW_ROUTE_KEY } from "@/lib/catalogue/catalogue-view";
import { resolveShopCatalogueView } from "@/lib/catalogue/catalogue-view.server";
import {
  fetchPublicArtists,
  fetchPublicArtworks,
  fetchPublicCategories,
} from "@/lib/shop-api.server";
import { MarketingCatalogView } from "@auction/marketing-ui";
import type { Metadata } from "next";

const CATALOGUE_TITLE = "Artworks";
const CATALOGUE_DESCRIPTION = "Browse limited-edition prints available through LAX Shop.";

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
  const [catalogue, categoryList, artistList, view] = await Promise.all([
    fetchPublicArtworks({
      limit: 24,
      ...(fetchQuery.cursor ? { cursor: fetchQuery.cursor } : {}),
      ...(fetchQuery.q ? { q: fetchQuery.q } : {}),
      ...(fetchQuery.categorySlug ? { categorySlug: fetchQuery.categorySlug } : {}),
      ...(fetchQuery.artistSlug ? { artistSlug: fetchQuery.artistSlug } : {}),
      ...(fetchQuery.saleState ? { saleState: fetchQuery.saleState } : {}),
      ...(fetchQuery.minPrice !== undefined ? { minPrice: fetchQuery.minPrice } : {}),
      ...(fetchQuery.maxPrice !== undefined ? { maxPrice: fetchQuery.maxPrice } : {}),
      ...(fetchQuery.sort ? { sort: fetchQuery.sort } : {}),
    }),
    fetchPublicCategories({ limit: 50 }),
    fetchPublicArtists({ limit: 50 }),
    resolveShopCatalogueView(SHOP_ARTWORKS_VIEW_ROUTE_KEY, query.view),
  ]);
  const { items, nextCursor, totalCount } = catalogue;
  const resultCount = totalCount ?? items.length;
  const categories = categoryList.items.map((item) => ({ slug: item.slug, label: item.label }));
  const artists = artistList.items.map((item) => ({ slug: item.slug, label: item.name }));

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

  return (
    <ShopCatalogueHub
      title={CATALOGUE_TITLE}
      description={description}
      footer={
        <div className="shop-catalogue-pager">
          <p className="shop-catalogue-pager__status">
            Showing {items.length} artwork{items.length === 1 ? "" : "s"}
            {state.cursor ? " on this page" : ""}
            {totalCount !== undefined ? ` of ${totalCount}` : ""}
          </p>
          <div className="shop-catalogue-pager__links">
            {previousHref ? (
              <ShopCataloguePagerLink href={previousHref}>Previous artworks</ShopCataloguePagerLink>
            ) : null}
            {nextCursor ? (
              <ShopCataloguePagerLink
                href={artworkCataloguePagerHref(state, {
                  cursor: nextCursor,
                  back: state.cursor ?? "",
                })}
              >
                Next artworks
              </ShopCataloguePagerLink>
            ) : null}
          </div>
        </div>
      }
    >
      <ArtworkCatalogueBrowse
        state={state}
        resultCount={resultCount}
        categories={categories}
        artists={artists}
        view={view}
      >
        {items.length === 0 ? (
          <ShopStatusState
            variant="empty"
            icon="search"
            title={filteredEmpty ? "No artworks match these filters" : "The catalogue is empty"}
            description={
              filteredEmpty
                ? "Try a different artist, category, price range, or availability — or clear filters to see the full collection."
                : "Check back soon for new works from LAX Shop."
            }
            actions={
              filteredEmpty ? (
                <ShopStatusStateLink href="/artworks" priority="primary">
                  Clear filters
                </ShopStatusStateLink>
              ) : undefined
            }
          />
        ) : (
          <MarketingCatalogView
            value={view}
            grid={<CatalogueGrid items={items} />}
            list={<CatalogueList items={items} />}
          />
        )}
      </ArtworkCatalogueBrowse>
    </ShopCatalogueHub>
  );
}
