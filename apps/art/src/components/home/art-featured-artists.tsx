import { ArtArtistCard } from "@/components/catalogue/art-artist-grid";
import { ArtArtistFollowButton } from "@/components/favorites/art-artist-follow-button.client";
import { ArtRail, ArtRailItem } from "@/components/layout/art-rail";
import { ArtSection } from "@/components/layout/art-section";
import { ArtMediaImage } from "@/components/media/art-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import type { ArtFavoriteAuth } from "@/lib/favorites/favorite-auth";
import type {
  FeaturedArtistPairItemVm,
  FeaturedArtistSoloVm,
  FeaturedArtistsVm,
} from "@/lib/home/art-featured-artists.vm";
import { ART_MEDIA_LABELS } from "@/lib/media/art-media-labels";
import { MarketingSplitFeature, marketingArtistInitials } from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";
import Link from "next/link";

const TITLE = "Featured artists";

function worksLinkLabel(card: CatalogueArtistCardVm): string {
  return `Works by ${card.name}`;
}

/** The portrait at 4:5; without one, the shared hatch with the artist's initials, as on the card. */
function Portrait({
  card,
  sizes,
}: {
  card: CatalogueArtistCardVm;
  sizes: string;
}) {
  if (!card.image) {
    return (
      <>
        <MediaPlaceholder fill />
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center font-headline text-4xl font-medium tracking-tight text-on-surface-variant"
        >
          {marketingArtistInitials(card.name)}
        </span>
      </>
    );
  }
  return (
    <ArtMediaImage
      src={card.image}
      alt=""
      label={ART_MEDIA_LABELS.artistPortrait}
      aspect={[4, 5]}
      sizes={sizes}
      className="absolute inset-0 size-full"
      imgClassName="object-cover"
    />
  );
}

/**
 * One artist, told at length: the portrait at its own 4:5 shape beside the facts, a short bio
 * and the way to their work. The split feature stands on the page itself, so only the portrait
 * reads as a frame, and on phones it stays a portrait instead of filling the first screen.
 */
function SoloArtist({
  solo,
  favoriteAuth,
}: { solo: FeaturedArtistSoloVm; favoriteAuth: ArtFavoriteAuth }) {
  const { card } = solo;
  return (
    <MarketingSplitFeature
      tone="plain"
      mediaSide="left"
      eyebrow="The artist"
      title={card.name}
      className="gap-8 bg-transparent md:gap-12 [&>:first-child]:aspect-[4/5] [&>:first-child]:w-[min(60%,16rem)] md:[&>:first-child]:aspect-auto md:[&>:first-child]:w-auto [&>:last-child]:px-0 [&>:last-child]:py-0 md:[&>:last-child]:py-16 md:[&>:last-child]:pe-8"
      media={
        <div className="absolute inset-0 flex items-center">
          <Link
            href={card.href}
            tabIndex={-1}
            aria-hidden="true"
            className="relative block aspect-[4/5] h-full max-w-full overflow-hidden bg-surface-container-low"
          >
            <Portrait card={card} sizes="(min-width: 48rem) 30vw, 60vw" />
          </Link>
        </div>
      }
      body={
        <div className="flex flex-col gap-2 text-on-surface">
          {solo.factsLine ? <p>{solo.factsLine}</p> : null}
          {solo.shortBio ? (
            <p className="line-clamp-2 text-on-surface-variant">{solo.shortBio}</p>
          ) : null}
          {card.worksLabel ? <p className="font-medium">{card.worksLabel}</p> : null}
        </div>
      }
      action={
        <>
          <Button asChild variant="secondaryOutline" size="lg">
            <Link href={card.href}>{worksLinkLabel(card)}</Link>
          </Button>
          <ArtArtistFollowButton
            slug={card.slug}
            name={card.name}
            initialFollowing={card.following}
            auth={favoriteAuth}
            className="min-h-11 px-5 text-sm font-medium normal-case tracking-normal"
          />
        </>
      }
    />
  );
}

/** One half of the pair: a portrait beside the name, facts, count and link. */
function PairRow({ item }: { item: FeaturedArtistPairItemVm }) {
  const { card } = item;
  return (
    <article className="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-4 lg:grid-cols-[10rem_minmax(0,1fr)] lg:gap-6">
      <Link
        href={card.href}
        tabIndex={-1}
        aria-hidden="true"
        className="relative block aspect-[4/5] overflow-hidden bg-surface-container-low"
      >
        <Portrait card={card} sizes="10rem" />
      </Link>
      <div className="flex min-w-0 flex-col items-start gap-1">
        <h3 className="line-clamp-2 font-headline text-xl font-medium leading-7 text-on-surface">
          {card.name}
        </h3>
        {item.factsLine ? (
          <p className="text-sm leading-5 text-on-surface-variant">{item.factsLine}</p>
        ) : null}
        {card.worksLabel ? (
          <p className="mt-1 text-sm font-medium leading-5 text-on-surface">{card.worksLabel}</p>
        ) : null}
        <Link
          href={card.href}
          className="mt-2 rounded-sm text-sm font-medium text-on-surface underline underline-offset-4 art-focus-ring"
        >
          {worksLinkLabel(card)}
        </Link>
      </div>
    </article>
  );
}

/**
 * The home's featured artists, laid out for their count so the section never leaves a row mostly
 * empty: one artist is a feature, two a pair, three or more the shared rail of artist cards.
 */
export function ArtFeaturedArtists({
  artists,
  favoriteAuth,
}: {
  artists: FeaturedArtistsVm;
  favoriteAuth: ArtFavoriteAuth;
}) {
  if (artists.layout === "feature") {
    return <SoloArtist solo={artists.solo} favoriteAuth={favoriteAuth} />;
  }
  return (
    <ArtSection id="featured-artists" title={TITLE} viewAllHref="/artists">
      {artists.layout === "pair" ? (
        <ul aria-label={TITLE} className="m-0 grid list-none gap-8 p-0 md:grid-cols-2 md:gap-x-12">
          {artists.items.map((item) => (
            <li key={item.card.slug}>
              <PairRow item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <ArtRail id="featured-artists-rail" label={TITLE}>
          {artists.cards.map((card) => (
            <ArtRailItem key={card.slug} size="tile">
              <ArtArtistCard card={card} favoriteAuth={favoriteAuth} />
            </ArtRailItem>
          ))}
        </ArtRail>
      )}
    </ArtSection>
  );
}
