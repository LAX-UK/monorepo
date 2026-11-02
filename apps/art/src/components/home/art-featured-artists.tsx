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
import {
  MarketingArtistFeature,
  MarketingArtistPair,
  MarketingArtistPairRow,
  MarketingArtistPortraitFill,
} from "@auction/marketing-ui";
import { Button } from "@auction/ui/components/button";
import Link from "next/link";

const TITLE = "Featured artists";

function worksLinkLabel(card: CatalogueArtistCardVm): string {
  return `Works by ${card.name}`;
}

function Portrait({ card, sizes }: { card: CatalogueArtistCardVm; sizes: string }) {
  return (
    <MarketingArtistPortraitFill
      name={card.name}
      image={
        card.image ? (
          <ArtMediaImage
            src={card.image}
            alt=""
            label={ART_MEDIA_LABELS.artistPortrait}
            aspect={[4, 5]}
            sizes={sizes}
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        ) : null
      }
    />
  );
}

function SoloArtist({
  solo,
  favoriteAuth,
}: {
  solo: FeaturedArtistSoloVm;
  favoriteAuth: ArtFavoriteAuth;
}) {
  const { card } = solo;
  return (
    <MarketingArtistFeature
      name={card.name}
      href={card.href}
      portrait={<Portrait card={card} sizes="(min-width: 48rem) 30vw, 60vw" />}
      eyebrow="The artist"
      facts={solo.factsLine}
      bio={solo.shortBio}
      count={card.worksLabel}
      actions={
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

function PairRow({ item }: { item: FeaturedArtistPairItemVm }) {
  const { card } = item;
  return (
    <MarketingArtistPairRow
      name={card.name}
      href={card.href}
      portrait={<Portrait card={card} sizes="10rem" />}
      facts={item.factsLine}
      count={card.worksLabel}
      linkLabel={worksLinkLabel(card)}
    />
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
        <MarketingArtistPair aria-label={TITLE}>
          {artists.items.map((item) => (
            <li key={item.card.slug}>
              <PairRow item={item} />
            </li>
          ))}
        </MarketingArtistPair>
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
