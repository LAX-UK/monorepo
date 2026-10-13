import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtArtworkList } from "@/components/catalogue/art-artwork-list";
import { ArtObjectTypeTiles } from "@/components/catalogue/art-object-type-tiles";
import { ArtworkCatalogueBrowse } from "@/components/catalogue/artwork-catalogue-browse";
import { artServices } from "@/lib/art-services.server";
import {
  type ArtworkCatalogueSearchParams,
  artworkCatalogueClearHref,
  artworkCatalogueHref,
} from "@/lib/catalogue/artwork-catalogue-params";
import { composeArtworksPage } from "@/lib/catalogue/artworks-page.composer";
import { ART_ARTWORKS_VIEW_ROUTE_KEY } from "@/lib/catalogue/catalogue-view";
import { resolveArtCatalogueView } from "@/lib/catalogue/catalogue-view.server";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingCatalogView } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

/** Shared body of `/artworks` and the medium landings (`/paintings`, `/prints`, `/sculptures`). */
export async function ArtArtworksCataloguePage({
  params,
}: {
  params: ArtworkCatalogueSearchParams;
}) {
  const [vm, view] = await Promise.all([
    composeArtworksPage(artServices, params),
    resolveArtCatalogueView(ART_ARTWORKS_VIEW_ROUTE_KEY, params.view),
  ]);

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-6 lg:py-10")}>
      <ArtPageHeader title={vm.title} />

      <ArtObjectTypeTiles tiles={vm.objectTypeTiles} />

      <ArtworkCatalogueBrowse
        state={vm.state}
        categories={vm.categories}
        artists={vm.artists}
        resultCount={vm.resultCount}
        view={view}
      >
        <section aria-labelledby="art-artworks-results">
          <h2 id="art-artworks-results" className="sr-only">
            Results
          </h2>
          {vm.failed ? (
            <ArtStatusState
              variant="error"
              title="Catalogue unavailable"
              description="We could not load artworks. Try again shortly."
              actions={
                <ArtStatusStateLink href={artworkCatalogueHref(vm.state)}>Retry</ArtStatusStateLink>
              }
            />
          ) : vm.cards.length === 0 ? (
            <ArtStatusState
              variant="empty"
              icon="search"
              title="No artworks match"
              description={
                vm.hasActiveFilters
                  ? "Try removing a filter or searching for another title or artist."
                  : "There are no published works yet. Check back soon."
              }
              {...(vm.hasActiveFilters
                ? {
                    actions: (
                      <ArtStatusStateLink href={artworkCatalogueClearHref()}>
                        Clear filters
                      </ArtStatusStateLink>
                    ),
                  }
                : {})}
            />
          ) : (
            <MarketingCatalogView
              value={view}
              grid={
                <ArtArtworkGrid cards={vm.cards} favoriteAuth={vm.favoriteAuth} priorityCount={2} />
              }
              list={<ArtArtworkList cards={vm.cards} favoriteAuth={vm.favoriteAuth} />}
            />
          )}
        </section>
      </ArtworkCatalogueBrowse>

      {vm.nextPageHref ? (
        <nav aria-label="Pagination" className="flex justify-center">
          <Button asChild variant="outline" className="min-h-11 font-label uppercase">
            <Link href={vm.nextPageHref}>Next page</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
