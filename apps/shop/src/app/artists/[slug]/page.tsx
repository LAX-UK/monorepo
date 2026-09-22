import { CatalogueGrid } from "@/components/catalogue-grid";
import { ShopCataloguePagerLink } from "@/components/catalogue/shop-catalogue-hub";
import { fetchPublicArtistBySlug, fetchPublicArtworks } from "@/lib/shop-api.server";
import { FOCUS_RING } from "@auction/branding";
import { MarketingDetailShell } from "@auction/marketing-ui";
import { DisplayHeading } from "@auction/ui";
import { cn } from "@auction/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

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
      title: `${artist.name} | LAX Shop`,
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

export default async function ArtistDetailPage({ params, searchParams }: ArtistDetailPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const artist = await fetchPublicArtistBySlug(slug);
  if (!artist) {
    notFound();
  }

  const artworks = await fetchPublicArtworks({
    limit: 24,
    artistSlug: slug,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  return (
    <MarketingDetailShell
      wayfinding={
        <Link
          href="/artists"
          className={cn("text-link underline-offset-4 hover:underline", FOCUS_RING)}
        >
          ← Back to artists
        </Link>
      }
      wayfindingClassName="pt-6"
      shellClassName="flex flex-col gap-8 py-4"
    >
      <header className="flex max-w-[var(--container-inner,86rem)] flex-col gap-3">
        <DisplayHeading as="h1" size="md">
          {artist.name}
        </DisplayHeading>
        {artist.discipline ? (
          <p className="font-label text-xs uppercase tracking-[var(--text-label-caps-tracking,0.22em)] text-secondary">
            {artist.discipline}
          </p>
        ) : null}
        {artist.bio ? (
          <p className="font-headline text-[length:var(--text-display-sm)] leading-snug text-on-surface">
            {artist.bio}
          </p>
        ) : null}
      </header>
      <CatalogueGrid items={artworks.items} />
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
    </MarketingDetailShell>
  );
}
