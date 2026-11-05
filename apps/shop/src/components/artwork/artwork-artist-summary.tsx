import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { EDITION_PAGE_COPY } from "@/content/artwork-edition-copy";
import type { ArtworkArtistVm } from "@/lib/artwork/artwork-product-page.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import {
  MarketingArrowUpRightIcon,
  MarketingArtistSummary,
  marketingArtistInitials,
} from "@auction/marketing-ui";

/**
 * "About the artist" on the shared summary, as on lax.art: a 48px portrait (or initials), the name
 * linking to Shop's editions by them, a two-line bio and two actions. No Follow. Without a bio the
 * name and actions stand alone; without lax.art configured the profile action is left out.
 */
export function ArtworkArtistSummary({ artist }: { artist: ArtworkArtistVm }) {
  return (
    <MarketingArtistSummary
      title={EDITION_PAGE_COPY.artistTitle}
      name={artist.name}
      href={artist.href}
      bio={artist.bio}
      nameLines={2}
      bioLines={2}
      className="shop-edition-artist"
      {...(artist.portraitUrl
        ? {
            avatar: (
              <ShopMediaImage
                src={artist.portraitUrl}
                alt=""
                monogram={marketingArtistInitials(artist.name)}
                label={SHOP_MEDIA_LABELS.artistPortrait}
                sizes="3rem"
                className="absolute inset-0 size-full"
                imgClassName="object-cover"
              />
            ),
          }
        : {})}
      actions={
        <>
          <ShopCommerceButton href={artist.href} variant="outline" scale="standard">
            {artist.editionsLabel}
          </ShopCommerceButton>
          {artist.laxArtHref ? (
            <a href={artist.laxArtHref} className="shop-home-more shop-focus-ring">
              {artist.laxArtLabel}
              <MarketingArrowUpRightIcon className="shop-home-more__icon" />
            </a>
          ) : null}
        </>
      }
    />
  );
}
