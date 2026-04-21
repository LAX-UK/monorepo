import { ArtistDirectory } from "@/components/sections/artists/artist-directory";
import { ArtistSpotlightHero } from "@/components/sections/artists/artist-spotlight-hero";
import { ArtistSubmitPortfolio } from "@/components/sections/artists/artist-submit-portfolio";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import { metadataForStatic } from "@/lib/seo/metadata-factory";
import { breadcrumbJsonLd, itemListJsonLd, jsonLdScript } from "@/lib/seo/structured-data";
import { getSiteUrl } from "@/lib/site-url";
import { Button } from "@auction/ui/components/button";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = metadataForStatic({
  title: "Artists",
  description:
    "Discover featured artists and makers behind the lots on LAX London Auction House Ltd — profiles, mediums, and portfolio context.",
  path: "/artist/featured",
});

export default async function FeaturedArtistsPage() {
  const reader = await getServerArtistReader();
  const artists = await reader.listFeatured();
  const base = getSiteUrl();

  if (artists.length === 0) {
    const crumbs = breadcrumbJsonLd([
      { name: "Home", path: "/" },
      { name: "Artists", path: "/artist/featured" },
    ]);
    const crumbText = jsonLdScript(crumbs);
    return (
      <main id="main-content">
        <script type="application/ld+json" suppressHydrationWarning>
          {crumbText}
        </script>
        <div className="mx-auto max-w-3xl px-8 py-24 text-center md:px-20 md:py-32">
          <h1 className="mb-6 font-headline text-4xl tracking-tight text-on-surface md:text-5xl">
            Featured artists
          </h1>
          <p className="mb-10 font-body text-on-surface-variant">
            Our roster is being refreshed — browse live sales or check back soon.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button variant="cta" asChild>
              <Link href="/sales">Browse sales</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/search">Search lots</Link>
            </Button>
          </div>
        </div>
        <ArtistSubmitPortfolio />
      </main>
    );
  }

  const spotlight = artists[0];
  const directoryRoster = artists.length > 1 ? artists.slice(1) : artists;
  const crumbs = breadcrumbJsonLd([
    { name: "Home", path: "/" },
    { name: "Artists", path: "/artist/featured" },
  ]);
  const rosterLd = itemListJsonLd(
    artists.map((a) => ({
      name: a.name,
      url: `${base}/artist/${a.id}`,
    })),
  );
  const jsonLdText = jsonLdScript(crumbs, rosterLd);

  return (
    <main id="main-content">
      <script type="application/ld+json" suppressHydrationWarning>
        {jsonLdText}
      </script>
      {spotlight ? <ArtistSpotlightHero artist={spotlight} /> : null}

      <div className="mx-auto max-w-[1920px] px-8 pt-8 md:px-20">
        <nav
          aria-label="Breadcrumb"
          className="font-label text-xs uppercase tracking-[0.2em] text-secondary"
        >
          <ol className="flex flex-wrap items-center gap-2">
            <li>
              <Link href="/" className="transition-colors hover:text-primary">
                Gallery
              </Link>
            </li>
            <li aria-hidden className="text-outline-variant">
              /
            </li>
            <li className="text-on-surface" aria-current="page">
              Artists
            </li>
          </ol>
        </nav>
      </div>

      <ArtistDirectory artists={directoryRoster} />
      <ArtistSubmitPortfolio />
    </main>
  );
}
