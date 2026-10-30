import { ArtSectionHeader } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import { ART_HUB_HEADINGS, type ArtHubSpotlightVm } from "@/lib/editorial/art-hub.vm";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import {
  MarketingArrowRightIcon,
  MarketingCardMedia,
  marketingArtistInitials,
} from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import Link from "next/link";

function SpotlightCard({ artist, solo }: { artist: ArtHubSpotlightVm; solo: boolean }) {
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-5",
        solo && "md:grid md:grid-cols-2 md:items-center md:gap-12",
      )}
      data-testid="art-hub-spotlight-card"
    >
      <MarketingCardMedia className="aspect-square bg-surface-container-low">
        {artist.imageUrl ? (
          <ArtMediaImage
            src={artist.imageUrl}
            alt={artist.imageAlt}
            label={ART_MEDIA_LABELS.artistPortrait}
            sizes="(min-width: 48rem) 50vw, 100vw"
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        ) : (
          // The established hatch with the artist's initials, as on every artist card.
          <>
            <MediaPlaceholder fill />
            <span
              aria-hidden
              className="absolute inset-0 flex items-center justify-center font-headline text-5xl font-medium tracking-tight text-on-surface-variant"
            >
              {marketingArtistInitials(artist.name)}
            </span>
          </>
        )}
      </MarketingCardMedia>
      <div className="flex flex-col gap-3">
        <h3 className="font-headline text-2xl font-medium leading-tight text-on-surface md:text-[2rem]">
          <Link
            href={artist.href}
            className="art-focus-ring rounded-sm underline-offset-4 after:absolute after:inset-0 group-hover:underline"
          >
            {artist.name}
          </Link>
        </h3>
        {artist.caption ? (
          <p className="text-sm leading-5 text-on-surface-variant">{artist.caption}</p>
        ) : null}
        {artist.intro ? (
          <p className="line-clamp-3 max-w-[60ch] text-base leading-7 text-on-surface-variant">
            {artist.intro}
          </p>
        ) : null}
        <span
          aria-hidden
          className="inline-flex items-center gap-2 text-sm font-medium text-on-surface underline underline-offset-4"
        >
          Discover the artist
          <MarketingArrowRightIcon className="size-4" />
        </span>
      </div>
    </article>
  );
}

/**
 * "In the spotlight" (Figma `1010:20329`): two artists side by side, each a large portrait with
 * their name and a short introduction; a single artist sits beside their introduction instead.
 */
export function ArtHubSpotlight({ artists }: { artists: readonly ArtHubSpotlightVm[] }) {
  if (artists.length === 0) return null;
  const solo = artists.length === 1;
  return (
    <section aria-labelledby="art-hub-spotlight-title" className="flex flex-col gap-6">
      <ArtSectionHeader
        headingId="art-hub-spotlight-title"
        title={ART_HUB_HEADINGS.spotlight}
        viewAllHref="/artists"
        viewAllSrLabel="artists"
      />
      <ul
        aria-label="Featured artists"
        className={cn("grid gap-x-6 gap-y-12", !solo && "md:grid-cols-2")}
      >
        {artists.map((artist) => (
          <li key={artist.slug}>
            <SpotlightCard artist={artist} solo={solo} />
          </li>
        ))}
      </ul>
    </section>
  );
}
