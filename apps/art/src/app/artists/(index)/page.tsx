import { ArtStatusState, ArtStatusStateLink } from "@/components/art-status-state";
import { ArtArtistGrid } from "@/components/catalogue/art-artist-grid";
import { artServices } from "@/lib/art-services.server";
import { composeArtistsPage } from "@/lib/catalogue/artists-page.composer";
import {
  MarketingArtistDirectory,
  marketingArtistDirectoryHref,
  parseMarketingArtistDirectoryQuery,
} from "@auction/marketing-ui";
import type { Metadata } from "next";

type ArtistsSearchParams = Record<string, string | string[] | undefined>;

type ArtistsPageProps = {
  searchParams: Promise<ArtistsSearchParams>;
};

const DESCRIPTION = "Discover artists with works available through the London Art Exchange.";

export async function generateMetadata({ searchParams }: ArtistsPageProps): Promise<Metadata> {
  const query = parseMarketingArtistDirectoryQuery(await searchParams);
  const filtered = Boolean(query.q || query.show || query.sort || query.cursor);
  const letter = query.letter?.toUpperCase();
  return {
    title: letter ? `Artists: ${letter} | lax.art` : "Artists | lax.art",
    description: "Artists represented on lax.art.",
    alternates: { canonical: query.letter ? `/artists?letter=${query.letter}` : "/artists" },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArtistsIndexPage({ searchParams }: ArtistsPageProps) {
  const vm = await composeArtistsPage(artServices, await searchParams);
  const { query } = vm;
  const filtered = Boolean(query.q || query.show || query.letter);

  return (
    <MarketingArtistDirectory
      basePath="/artists"
      title="Artists"
      description={DESCRIPTION}
      query={query}
      total={vm.total}
      pageCount={vm.cards.length}
      nextCursor={vm.nextCursor ?? undefined}
    >
      {vm.failed ? (
        <ArtStatusState
          variant="error"
          title="Artists unavailable"
          description="We could not load artists. Try again shortly."
          actions={
            <ArtStatusStateLink href={marketingArtistDirectoryHref("/artists", query)}>
              Retry
            </ArtStatusStateLink>
          }
        />
      ) : vm.cards.length === 0 ? (
        filtered ? (
          <ArtStatusState
            variant="empty"
            title={
              query.letter && !query.q && !query.show
                ? `No artists under ${query.letter.toUpperCase()}`
                : "No artists match these filters"
            }
            description="Try another letter or search, or browse the full directory."
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
          nameAs="h2"
          aria-label={
            query.letter ? `Artists starting with ${query.letter.toUpperCase()}` : "Artists"
          }
        />
      )}
    </MarketingArtistDirectory>
  );
}
