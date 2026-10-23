import { ArtPageHeader } from "@/components/art-page-header";
import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { ArtSection } from "@/components/layout/art-section";
import { artServices } from "@/lib/art-services.server";
import { composeArtistsPage, parseArtistLetter } from "@/lib/catalogue/artists-page.composer";
import { MARKETING_PAGE_SHELL } from "@auction/branding";
import { MarketingAlphabetFilter } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

type ArtistsSearchParams = { cursor?: string | string[]; letter?: string | string[] };

type ArtistsPageProps = {
  searchParams: Promise<ArtistsSearchParams>;
};

export async function generateMetadata({ searchParams }: ArtistsPageProps): Promise<Metadata> {
  const params = await searchParams;
  const letter = parseArtistLetter(params.letter);
  return {
    title: letter ? `Artists: ${letter} | LAX Art` : "Artists | LAX Art",
    description: "Artists represented on lax.art.",
    alternates: { canonical: letter ? `/artists?letter=${letter.toLowerCase()}` : "/artists" },
    ...(params.cursor ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArtistsIndexPage({ searchParams }: ArtistsPageProps) {
  const vm = await composeArtistsPage(artServices, await searchParams);

  return (
    <div className={cn(MARKETING_PAGE_SHELL, "flex flex-col gap-8 py-6 lg:py-10")}>
      <ArtPageHeader
        title="Artists"
        description="Discover artists with works available through the London Art Exchange."
      />
      {vm.featured.length > 0 ? (
        <ArtSection id="featured-artists" title="Featured artists">
          <ArtArtistGrid
            cards={vm.featured}
            favoriteAuth={vm.favoriteAuth}
            aria-label="Featured artists"
          />
        </ArtSection>
      ) : null}
      <MarketingAlphabetFilter basePath="/artists" active={vm.letter} />

      {vm.failed ? (
        <ArtStatusState
          variant="error"
          title="Artists unavailable"
          description="We could not load artists. Try again shortly."
          actions={
            <ArtStatusStateLink
              href={vm.letter ? `/artists?letter=${vm.letter.toLowerCase()}` : "/artists"}
            >
              Retry
            </ArtStatusStateLink>
          }
        />
      ) : vm.cards.length === 0 ? (
        vm.letter ? (
          <ArtStatusState
            variant="empty"
            title={`No artists under ${vm.letter}`}
            description="Try another letter or browse the full directory."
            actions={<ArtStatusStateLink href="/artists">Show all artists</ArtStatusStateLink>}
          />
        ) : (
          <ArtStatusState
            variant="empty"
            title="No artists yet"
            description="Artist profiles will appear here as works enter the lax.art catalogue."
            actions={<ArtStatusStateLink href="/artworks">Browse artworks</ArtStatusStateLink>}
          />
        )
      ) : (
        <ArtArtistGrid
          cards={vm.cards}
          favoriteAuth={vm.favoriteAuth}
          aria-label={vm.letter ? `Artists starting with ${vm.letter}` : "Artists"}
        />
      )}

      {vm.nextPageHref ? (
        <nav aria-label="Pagination" className="flex justify-center">
          <Button asChild variant="outline" className="min-h-11 font-label">
            <Link href={vm.nextPageHref}>Next page</Link>
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
