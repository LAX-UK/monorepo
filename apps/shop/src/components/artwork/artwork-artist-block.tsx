import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import type { ArtworkArtistBlockVm } from "@/lib/artwork/artwork-product-page.vm";
import { artistInitials } from "@/lib/catalogue/catalogue-artist-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingArrowUpRightIcon, type MarketingSectionSurface } from "@auction/marketing-ui";
import { MediaPlaceholder } from "@auction/ui/components/media-placeholder";

/**
 * The artist, on the gallery's paper wall: their portrait, a line about them, their editions here
 * and their full story on lax.art. Without a portrait, the shared placeholder carries initials.
 * On the `plain` surface it stands on the page, so it never touches another tinted band.
 */
export function ArtworkArtistBlock({
  artist,
  surface = "band",
}: {
  artist: ArtworkArtistBlockVm;
  surface?: MarketingSectionSurface;
}) {
  return (
    <section
      className="shop-artist-block"
      data-surface={surface}
      aria-labelledby="artist-block-heading"
    >
      <div className="shop-artist-block__portrait">
        {artist.portraitUrl ? (
          <ShopMediaImage
            src={artist.portraitUrl}
            alt=""
            label={SHOP_MEDIA_LABELS.artistPortrait}
            sizes="(min-width: 64rem) 30vw, 90vw"
            className="absolute inset-0 size-full"
            imgClassName="object-cover"
          />
        ) : (
          <>
            <MediaPlaceholder fill />
            <span className="shop-artist-block__initials" aria-hidden="true">
              {artistInitials(artist.name)}
            </span>
          </>
        )}
      </div>
      <div className="shop-artist-block__body">
        <p className="shop-home-eyebrow">The artist</p>
        <h2 id="artist-block-heading" className="shop-artist-block__name">
          {artist.name}
        </h2>
        {artist.discipline ? (
          <p className="shop-artist-block__discipline">{artist.discipline}</p>
        ) : null}
        {artist.summary ? <p className="shop-artist-block__summary">{artist.summary}</p> : null}
        <div className="shop-artist-block__actions">
          <ShopCommerceButton href={artist.editionsHref} variant="outline" scale="standard">
            {artist.editionsLabel}
          </ShopCommerceButton>
          {artist.laxArtHref ? (
            <a href={artist.laxArtHref} className="shop-home-more shop-focus-ring">
              Their full story on lax.art
              <MarketingArrowUpRightIcon className="shop-home-more__icon" />
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}
