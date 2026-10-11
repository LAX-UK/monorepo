import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtworkCatalogueBrowse } from "@/components/catalogue/artwork-catalogue-browse";
import { artServices } from "@/lib/art-services.server";
import { artworkCatalogueClearHref } from "@/lib/catalogue/artwork-catalogue-params";
import {
  composeArtworksPage,
  composeArtworksPageTitle,
} from "@/lib/catalogue/artworks-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

type ArtworksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ searchParams }: ArtworksPageProps): Promise<Metadata> {
  return {
    title: `${composeArtworksPageTitle(await searchParams)} | LAX Art`,
    alternates: { canonical: "/artworks" },
  };
}

export default async function ArtworksPage({ searchParams }: ArtworksPageProps) {
  const vm = await composeArtworksPage(artServices, await searchParams);

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-6 lg:py-10")}>
      <ArtPageHeader title={vm.title} />

      <ArtworkCatalogueBrowse
        state={vm.state}
        categories={vm.categories}
        artists={vm.artists}
        resultCount={vm.resultCount}
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
              actions={<ArtStatusStateLink href="/artworks">Retry</ArtStatusStateLink>}
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
            <ArtArtworkGrid cards={vm.cards} favoriteAuth={vm.favoriteAuth} priorityCount={2} />
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
