import { ArtistDirectory } from "@/components/sections/artists/artist-directory";
import { ArtistSpotlightHero } from "@/components/sections/artists/artist-spotlight-hero";
import { ArtistSubmitPortfolio } from "@/components/sections/artists/artist-submit-portfolio";
import { getServerArtistReader } from "@/lib/data/http/artist.server";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Artists",
  description:
    "Discover featured artists and makers behind the lots on The Digital Curator—profiles, mediums, and portfolio context.",
};

export default async function FeaturedArtistsPage() {
  const reader = await getServerArtistReader();
  const artists = await reader.listFeatured();
  const spotlight = artists[0];
  const directoryRoster = artists.length > 1 ? artists.slice(1) : artists;

  return (
    <main id="main-content">
      {spotlight ? <ArtistSpotlightHero artist={spotlight} /> : null}

      <div className="mx-auto max-w-[1920px] px-8 pt-8 md:px-20">
        <nav
          aria-label="Breadcrumb"
          className="font-label text-[10px] uppercase tracking-[0.2em] text-secondary"
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
