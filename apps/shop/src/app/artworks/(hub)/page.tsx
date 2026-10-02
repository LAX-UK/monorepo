import { CatalogueGrid } from "@/components/catalogue-grid";
import { ArtworkCatalogueBrowse } from "@/components/catalogue/artwork-catalogue-browse";
import {
  ShopCatalogueHub,
  ShopCataloguePagerLink,
} from "@/components/catalogue/shop-catalogue-hub";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import {
  artworkCatalogueFetchQuery,
  artworkCatalogueHasActiveFilters,
  artworkCataloguePageTitle,
  artworkCataloguePagerHref,
  parseArtworkCatalogueParams,
} from "@/lib/catalogue/artwork-catalogue-params";
import {
  fetchPublicArtists,
  fetchPublicArtworks,
  fetchPublicCategories,
} from "@/lib/shop-api.server";
import type { Metadata } from "next";

type ArtworksIndexPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ArtworksIndexPageProps): Promise<Metadata> {
  const state = parseArtworkCatalogueParams(await searchParams);
  const title = `${artworkCataloguePageTitle(state)} | LAX Shop`;
  const description = state.q
    ? `Search results for “${state.q}” in the LAX Shop catalogue.`
    : state.type === "edition"
      ? "Editioned prints and multiples from the LAX Shop catalogue."
      : "Browse contemporary artworks available through LAX Shop.";
  return {
    title,
    description,
    alternates: { canonical: "/artworks" },
  };
}

export default async function ArtworksIndexPage({ searchParams }: ArtworksIndexPageProps) {
  const state = parseArtworkCatalogueParams(await searchParams);
  const fetchQuery = artworkCatalogueFetchQuery(state);
  const [catalogue, categoryList, artistList] = await Promise.all([
    fetchPublicArtworks({
      limit: 24,
      ...(fetchQuery.cursor ? { cursor: fetchQuery.cursor } : {}),
      ...(fetchQuery.q ? { q: fetchQuery.q } : {}),
      ...(fetchQuery.categorySlug ? { categorySlug: fetchQuery.categorySlug } : {}),
      ...(fetchQuery.artistSlug ? { artistSlug: fetchQuery.artistSlug } : {}),
      ...(fetchQuery.saleState ? { saleState: fetchQuery.saleState } : {}),
      ...(fetchQuery.type ? { type: fetchQuery.type } : {}),
      ...(fetchQuery.minPrice !== undefined ? { minPrice: fetchQuery.minPrice } : {}),
      ...(fetchQuery.maxPrice !== undefined ? { maxPrice: fetchQuery.maxPrice } : {}),
      ...(fetchQuery.sort ? { sort: fetchQuery.sort } : {}),
    }),
    fetchPublicCategories({ limit: 50 }),
    fetchPublicArtists({ limit: 50 }),
  ]);
  const { items, nextCursor, totalCount } = catalogue;
  const resultCount = totalCount ?? items.length;
  const categories = categoryList.items.map((item) => ({ slug: item.slug, label: item.label }));
  const artists = artistList.items.map((item) => ({ slug: item.slug, label: item.name }));

  const title = artworkCataloguePageTitle(state);
  const description = state.q
    ? `Search results for “${state.q}” in the LAX Shop catalogue.`
    : state.type === "edition"
      ? "Editioned prints and multiples from the LAX Shop catalogue."
      : "Browse contemporary artworks available through LAX Shop.";

  const showPrevious = Boolean(state.cursor);
  const previousHref = showPrevious
    ? state.back
      ? artworkCataloguePagerHref(state, { cursor: state.back, back: null })
      : artworkCataloguePagerHref(state, { cursor: null, back: null })
    : null;

  const filteredEmpty = items.length === 0 && artworkCatalogueHasActiveFilters(state);

  return (
    <ShopCatalogueHub
      title={title}
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
          <CatalogueGrid items={items} />
        )}
      </ArtworkCatalogueBrowse>
    </ShopCatalogueHub>
  );
}
