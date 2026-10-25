import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopStatusState, ShopStatusStateLink } from "@/components/shop-status-state";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { fetchPublicArtists } from "@/lib/shop-api.server";
import {
  MarketingArtistCard,
  MarketingArtistDirectory,
  type MarketingArtistDirectoryQuery,
  MarketingArtistGrid,
  parseMarketingArtistDirectoryQuery,
} from "@auction/marketing-ui";
import type { PublicArtistList } from "@auction/shop-contracts";
import type { Metadata } from "next";

type ArtistsSearchParams = Record<string, string | string[] | undefined>;

type ArtistsIndexPageProps = {
  searchParams: Promise<ArtistsSearchParams>;
};

const DESCRIPTION = "Discover artists represented in the LAX Shop catalogue.";

export async function generateMetadata({ searchParams }: ArtistsIndexPageProps): Promise<Metadata> {
  const query = parseMarketingArtistDirectoryQuery(await searchParams);
  const filtered = Boolean(query.q || query.show || query.sort || query.cursor);
  return {
    title: query.letter
      ? `Artists: ${query.letter.toUpperCase()} | LAX Shop`
      : "Artists | LAX Shop",
    description: DESCRIPTION,
    alternates: { canonical: query.letter ? `/artists?letter=${query.letter}` : "/artists" },
    ...(filtered ? { robots: { index: false, follow: true } } : {}),
  };
}

function editionCountLabel(count: number): string {
  return `${count} ${count === 1 ? "edition" : "editions"}`;
}

async function loadArtists(query: MarketingArtistDirectoryQuery): Promise<PublicArtistList | null> {
  try {
    return await fetchPublicArtists({
      limit: 24,
      ...(query.show === "featured" ? { placement: "featured_artists" as const } : {}),
      ...(query.q ? { q: query.q } : {}),
      ...(query.letter ? { letter: query.letter } : {}),
      sort: query.sort === "recent" ? "newest" : "nameAsc",
      ...(query.cursor ? { cursor: query.cursor } : {}),
    });
  } catch {
    return null;
  }
}

export default async function ArtistsIndexPage({ searchParams }: ArtistsIndexPageProps) {
  const query = parseMarketingArtistDirectoryQuery(await searchParams);
  const list = await loadArtists(query);
  const items = list?.items ?? [];
  const filtered = Boolean(query.q || query.show || query.letter);

  return (
    <MarketingArtistDirectory
      as="main"
      basePath="/artists"
      title="Artists"
      description={DESCRIPTION}
      query={query}
      total={list?.total ?? null}
      pageCount={items.length}
      nextCursor={list?.nextCursor}
    >
      {list === null ? (
        <ShopStatusState
          variant="error"
          title="Artists unavailable"
          description="We could not load artists. Try again shortly."
          actions={<ShopStatusStateLink href="/artists">Try again</ShopStatusStateLink>}
        />
      ) : items.length === 0 ? (
        filtered ? (
          <ShopStatusState
            variant="empty"
            title="No artists match these filters"
            description="Try another letter or search, or browse every artist."
            actions={<ShopStatusStateLink href="/artists">Show all artists</ShopStatusStateLink>}
          />
        ) : (
          <ShopStatusState
            variant="empty"
            title="No artists yet"
            description="Artist profiles will appear here as their work enters the shop catalogue."
            actions={
              <ShopStatusStateLink href="/artworks">Browse all artworks</ShopStatusStateLink>
            }
          />
        )
      ) : (
        <MarketingArtistGrid aria-label="Artists">
          {items.map((artist) => (
            <MarketingArtistCard
              key={artist.slug}
              href={`/artists/${encodeURIComponent(artist.slug)}`}
              name={artist.name}
              facts={artist.discipline}
              caption={artist.artworkCount > 0 ? editionCountLabel(artist.artworkCount) : null}
              {...(artist.portraitUrl
                ? {
                    portrait: (
                      <ShopMediaImage
                        src={artist.portraitUrl}
                        alt=""
                        label={SHOP_MEDIA_LABELS.artistPortrait}
                        aspect={[4, 5]}
                        sizes="(min-width: 96rem) 20vw, (min-width: 64rem) 25vw, (min-width: 48rem) 30vw, 50vw"
                        className="absolute inset-0 size-full object-cover"
                      />
                    ),
                  }
                : {})}
            />
          ))}
        </MarketingArtistGrid>
      )}
    </MarketingArtistDirectory>
  );
}
