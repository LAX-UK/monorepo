import { CatalogueGrid } from "@/components/catalogue-grid";
import { ShopCataloguePagerLink } from "@/components/catalogue/shop-catalogue-hub";
import { ShopMediaImage } from "@/components/media/shop-media-image";
import {
  loadShopArtBaseUrl,
  loadShopStorefrontBaseUrl,
} from "@/lib/ecosystem/product-directory.server";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { fetchPublicArtistBySlug, fetchPublicArtworks } from "@/lib/shop-api.server";
import { FOCUS_RING } from "@auction/branding";
import {
  type MarketingArtistCrossLink,
  MarketingArtistCrossLinks,
  MarketingArtistFacts,
  MarketingArtistHero,
  MarketingDetailShell,
  MarketingReadMore,
  MarketingShareButton,
  marketingArtistFacts,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

type ArtistDetailPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cursor?: string }>;
};

export async function generateMetadata({ params }: ArtistDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const artist = await fetchPublicArtistBySlug(slug);
    if (!artist) {
      return {
        title: "Artist not found | LAX Shop",
        robots: { index: false, follow: false },
      };
    }
    const description =
      artist.bio ?? `Discover artworks by ${artist.name} in the LAX Shop catalogue.`;
    return {
      title: `Editions by ${artist.name} | LAX Shop`,
      description,
      alternates: { canonical: `/artists/${encodeURIComponent(slug)}` },
    };
  } catch {
    return {
      title: "Artist | LAX Shop",
      robots: { index: false, follow: false },
    };
  }
}

function artistOnArtHref(slug: string): string | null {
  const art = loadShopArtBaseUrl();
  return art ? new URL(`/artists/${encodeURIComponent(slug)}`, art).toString() : null;
}

/**
 * "Editions by {artist}": the artist's Shop editions with links to the full profile on lax.art
 * and to their lots on LAX Bid. An artist with no editions here goes to lax.art instead.
 */
export default async function ArtistDetailPage({ params, searchParams }: ArtistDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const artist = await fetchPublicArtistBySlug(slug);
  if (!artist) {
    notFound();
  }

  const artHref = artistOnArtHref(slug);
  const artworks = await fetchPublicArtworks({
    limit: 24,
    artistSlug: slug,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  if (artworks.items.length === 0 && !query.cursor && artHref) {
    redirect(artHref);
  }

  const crossLinks: MarketingArtistCrossLink[] = [
    ...(artHref
      ? [
          {
            id: "art",
            label: "About the artist on lax.art",
            description: "Biography, original works and exhibitions",
            href: artHref,
          },
        ]
      : []),
  ];
  const summary = artist.bio?.trim() || null;
  const pageUrl = new URL(`/artists/${encodeURIComponent(slug)}`, loadShopStorefrontBaseUrl());

  return (
    <MarketingDetailShell
      wayfinding={
        <Link
          href="/artists"
          className={cn(
            "inline-flex min-h-11 items-center rounded-sm font-body text-sm text-on-surface-variant hover:text-on-surface hover:underline",
            FOCUS_RING,
          )}
        >
          ← Back to artists
        </Link>
      }
      wayfindingClassName="pt-6"
      shellClassName="flex flex-col gap-12 py-4 lg:gap-16"
    >
      <MarketingArtistHero
        size="compact"
        eyebrow="Editions by"
        name={artist.name}
        facts={
          <MarketingArtistFacts
            facts={marketingArtistFacts({
              nationality: artist.nationality,
              birthYear: artist.birthYear,
              deathYear: artist.deathYear,
              discipline: artist.discipline,
            })}
          />
        }
        summary={
          summary ? (
            <MarketingReadMore lines={4}>
              <p className="whitespace-pre-line">{summary}</p>
            </MarketingReadMore>
          ) : null
        }
        actions={
          <MarketingShareButton url={pageUrl.toString()} title={`Editions by ${artist.name}`} />
        }
        crossLinks={<MarketingArtistCrossLinks links={crossLinks} />}
        portrait={
          artist.portraitUrl ? (
            <ShopMediaImage
              src={artist.portraitUrl}
              alt={`Portrait of ${artist.name}`}
              label={SHOP_MEDIA_LABELS.artistPortrait}
              aspect={[4, 5]}
              sizes="(min-width: 48rem) 20rem, 14rem"
              priority
              className="absolute inset-0 size-full object-cover"
            />
          ) : null
        }
      />
      <section aria-labelledby="artist-editions-heading" className="flex flex-col gap-6">
        <h2
          id="artist-editions-heading"
          className="font-headline text-[length:clamp(1.5rem,2.8vw,2rem)] font-medium leading-tight text-on-surface"
        >
          Editions
        </h2>
        <CatalogueGrid
          items={artworks.items}
          titleLevel={3}
          hideArtist
          aria-label={`Editions by ${artist.name}`}
        />
        {artworks.nextCursor ? (
          <ShopCataloguePagerLink
            href={{
              pathname: `/artists/${slug}`,
              query: { cursor: artworks.nextCursor },
            }}
          >
            Next artworks
          </ShopCataloguePagerLink>
        ) : null}
      </section>
    </MarketingDetailShell>
  );
}
