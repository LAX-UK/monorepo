import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingArtistCard } from "@auction/marketing-ui";

const CARD_SIZES = "(min-width: 64rem) 22vw, (min-width: 40rem) 30vw, 45vw";

/** The shared artist card: portrait, name, discipline and "4 editions", to their editions. */
export function ShopArtistCard({
  card,
  nameAs = "h3",
}: {
  card: CatalogueArtistCardVm;
  nameAs?: "h2" | "h3";
}) {
  return (
    <MarketingArtistCard
      href={card.href}
      name={card.name}
      nameAs={nameAs}
      facts={card.discipline}
      caption={card.editionsLabel}
      {...(card.image
        ? {
            portrait: (
              <ShopMediaImage
                src={card.image}
                alt=""
                label={SHOP_MEDIA_LABELS.artistPortrait}
                aspect={[4, 5]}
                sizes={CARD_SIZES}
                className="absolute inset-0 size-full object-cover"
              />
            ),
          }
        : {})}
    />
  );
}
