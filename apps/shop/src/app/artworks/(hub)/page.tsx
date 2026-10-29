import { ArtworkCatalogueBrowse } from "@/components/catalogue/artwork-catalogue-browse";
import { CatalogueResults } from "@/components/catalogue/catalogue-results";
import {
  CatalogueEmpty,
  CatalogueNoMatch,
  CatalogueSearchEmpty,
  CatalogueUnavailable,
} from "@/components/catalogue/catalogue-states";
import { ShopCatalogueHub } from "@/components/catalogue/shop-catalogue-hub";
import {
  artworkCatalogueClearHref,
  parseArtworkCatalogueParams,
} from "@/lib/catalogue/artwork-catalogue-params";
import { shopApiCatalogueReader } from "@/lib/catalogue/catalogue-page.adapter.server";
import { composeCataloguePage } from "@/lib/catalogue/catalogue-page.composer";
import { buildCatalogueSort } from "@/lib/catalogue/catalogue-sort";
import { SHOP_ARTWORKS_VIEW_ROUTE_KEY } from "@/lib/catalogue/catalogue-view";
import { resolveShopCatalogueView } from "@/lib/catalogue/catalogue-view.server";
import { loadShopArtBaseUrl } from "@/lib/ecosystem/product-directory.server";
import type { Metadata } from "next";

const CATALOGUE_TITLE = "Editions";
const CATALOGUE_DESCRIPTION =
  "Limited-edition prints by LAX artists, with insured UK delivery or collection in London.";

type ArtworksIndexPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  searchParams,
}: ArtworksIndexPageProps): Promise<Metadata> {
  const state = parseArtworkCatalogueParams(await searchParams);
  return {
    title: `${CATALOGUE_TITLE} | LAX Shop`,
    description: state.q
      ? `Search results for “${state.q}” in the LAX Shop catalogue.`
      : CATALOGUE_DESCRIPTION,
    alternates: { canonical: "/artworks" },
  };
}

/** Original works live on lax.art; the link is left out where lax.art is not configured. */
function originalWorksHref(): string | null {
  const base = loadShopArtBaseUrl();
  return base ? new URL("/artworks", base).toString() : null;
}

export default async function ArtworksIndexPage({ searchParams }: ArtworksIndexPageProps) {
  const query = await searchParams;
  const state = parseArtworkCatalogueParams(query);
  const [page, view] = await Promise.all([
    composeCataloguePage(shopApiCatalogueReader, state),
    resolveShopCatalogueView(SHOP_ARTWORKS_VIEW_ROUTE_KEY, query.view),
  ]);

  switch (page.kind) {
    case "unavailable":
      return (
        <ShopCatalogueHub title={CATALOGUE_TITLE}>
          <CatalogueUnavailable />
        </ShopCatalogueHub>
      );
    case "empty":
      return (
        <ShopCatalogueHub title={CATALOGUE_TITLE} description={page.countLine}>
          <CatalogueEmpty artHref={originalWorksHref()} />
        </ShopCatalogueHub>
      );
    case "search-empty":
      return (
        <ShopCatalogueHub eyebrow="Search" title={`No results for “${page.query}”`}>
          <CatalogueSearchEmpty
            didYouMean={page.didYouMean}
            artists={page.artists}
            availableNow={page.availableNow}
          />
        </ShopCatalogueHub>
      );
    case "catalogue":
      return (
        <ShopCatalogueHub title={CATALOGUE_TITLE} description={page.countLine}>
          <ArtworkCatalogueBrowse
            rail={page.rail}
            quickChips={page.quickChips}
            activeChips={page.activeChips}
            activeCount={page.activeCount}
            sort={buildCatalogueSort(state)}
            clearHref={artworkCatalogueClearHref(state)}
            resultLabel={page.liveMessage}
            view={view}
            showViewSwitch={page.noMatch === null}
          >
            {page.noMatch ? (
              <CatalogueNoMatch noMatch={page.noMatch} />
            ) : (
              <CatalogueResults results={page.results} view={view} />
            )}
          </ArtworkCatalogueBrowse>
        </ShopCatalogueHub>
      );
  }
}
