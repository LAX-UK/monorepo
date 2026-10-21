import { ArtMediaImage } from "@/components/media/art-media-image";
import type { ExhibitionArtistVm } from "@/lib/editorial/exhibition-page.vm";
import { MarketingReadMore } from "@auction/marketing-ui";
import Link from "next/link";

/** Portrait beside name, life line and a clamped biography (Figma Featured artists, `743:20964`). */
export function ArtExhibitionArtists({ artists }: { artists: readonly ExhibitionArtistVm[] }) {
  return (
    <ul className="grid gap-x-8 gap-y-10 md:grid-cols-2" aria-label="Featured artists">
      {artists.map((artist) => (
        <li
          key={artist.slug}
          className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-4 sm:gap-6"
        >
          <Link
            href={artist.href}
            className="art-focus-ring relative block aspect-[4/5] overflow-hidden bg-surface-container"
            aria-label={`${artist.name}, artist profile`}
          >
            <ArtMediaImage
              src={artist.portraitUrl}
              alt=""
              label="Artist"
              sizes="(min-width: 48rem) 20vw, 35vw"
              className="absolute inset-0 size-full"
              imgClassName="object-cover"
            />
          </Link>
          <div className="flex min-w-0 flex-col gap-2 md:text-center">
            <h3 className="m-0 font-headline text-lg font-medium leading-7 text-on-surface md:text-xl">
              <Link href={artist.href} className="art-focus-ring rounded-sm hover:underline">
                {artist.name}
              </Link>
            </h3>
            {artist.lifeLine ? (
              <p className="m-0 text-sm text-on-surface">{artist.lifeLine}</p>
            ) : null}
            {artist.bio ? (
              <MarketingReadMore
                lines={4}
                className="text-sm leading-relaxed text-on-surface-variant"
              >
                <p className="m-0">{artist.bio}</p>
              </MarketingReadMore>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
