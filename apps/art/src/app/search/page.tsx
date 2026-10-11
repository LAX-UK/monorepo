import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { ArtArtworkGrid } from "@/components/catalogue/art-artwork-grid";
import { ArtSection } from "@/components/layout/art-section";
import { ArtSearchForm } from "@/components/search/art-search-form";
import { artServices } from "@/lib/art-services.server";
import { composeSearchPage } from "@/lib/search/search-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { cn } from "@auction/ui";
import type { Metadata } from "next";

type SearchPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Search | LAX Art",
  robots: { index: false, follow: true },
};

export default async function ArtSearchPage({ searchParams }: SearchPageProps) {
  const vm = await composeSearchPage(artServices, await searchParams);

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-10 py-6 lg:py-10")}>
      <div className="flex flex-col gap-6">
        <ArtPageHeader title={vm.query ? `Results for “${vm.query}”` : "Search"} />
        <ArtSearchForm defaultValue={vm.query} />
      </div>

      {vm.status === "idle" ? (
        <ArtStatusState
          variant="empty"
          icon="search"
          title="Search lax.art"
          description="Find originals by title or artist name."
        />
      ) : null}

      {vm.status === "unavailable" ? (
        <ArtStatusState
          variant="error"
          title="Search unavailable"
          description="We could not search the catalogue. Try again shortly."
          actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
        />
      ) : null}

      {vm.status === "no_results" ? (
        <div data-testid="art-search-no-results">
          <ArtStatusState
            variant="empty"
            icon="search"
            title={`No results for “${vm.query}”`}
            description="Check the spelling or try a broader title or artist name."
            actions={<ArtStatusStateLink href="/artworks">Browse all artworks</ArtStatusStateLink>}
          />
        </div>
      ) : null}

      {vm.status === "results" ? (
        <>
          {vm.artists.length > 0 ? (
            <ArtSection id="search-artists" title="Artists">
              <ArtArtistGrid cards={vm.artists} />
            </ArtSection>
          ) : null}
          {vm.artworks.length > 0 ? (
            <ArtSection
              id="search-artworks"
              title="Artworks"
              {...(vm.allArtworksHref ? { viewAllHref: vm.allArtworksHref } : {})}
            >
              <ArtArtworkGrid cards={vm.artworks} favoriteAuth={vm.favoriteAuth} />
            </ArtSection>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
