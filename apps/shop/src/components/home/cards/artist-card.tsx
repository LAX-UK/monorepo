import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCardMedia, MarketingCardShell } from "@auction/marketing-ui";
import Link from "next/link";

type ArtistCardProps = {
  card: CatalogueArtistCardVm;
  /** h2 on the artist index, h3 inside a titled home section. */
  titleLevel?: 2 | 3;
};

/**
 * An artist with editions in the Shop: portrait, name, discipline and how many editions. Without
 * a portrait the mat carries the artist's initials rather than an empty placeholder.
 */
export function ArtistCard({ card, titleLevel = 3 }: ArtistCardProps) {
  const Title = titleLevel === 2 ? "h2" : "h3";
  return (
    <MarketingCardShell interactive className="shop-artist-card">
      <MarketingCardMedia className="shop-artist-card__media">
        {card.image ? (
          <ShopMediaImage
            src={card.image}
            alt={card.imageAlt}
            label={SHOP_MEDIA_LABELS.artistPortrait}
            sizes="(min-width: 80rem) 22vw, (min-width: 64rem) 28vw, 50vw"
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        ) : (
          <span className="shop-artist-card__monogram" aria-hidden>
            {card.initials}
          </span>
        )}
      </MarketingCardMedia>
      <div className="shop-artist-card__body">
        <Title className="shop-artist-card__name">
          <Link href={card.href} className="shop-artist-card__link">
            {card.name}
          </Link>
        </Title>
        {card.discipline ? <p className="shop-artist-card__meta">{card.discipline}</p> : null}
        {card.editionsLabel ? (
          <p className="shop-artist-card__count">{card.editionsLabel}</p>
        ) : null}
      </div>
    </MarketingCardShell>
  );
}
