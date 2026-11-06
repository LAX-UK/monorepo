import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import { MarketingArtistCard, marketingArtistInitials } from "@auction/marketing-ui";

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
      withoutImage="initials"
      {...(card.workImage
        ? {
            work: (
              <ShopMediaImage
                src={card.workImage}
                alt=""
                aspect={[4, 5]}
                sizes={CARD_SIZES}
                className="absolute inset-0 size-full"
                imgClassName="object-contain"
              />
            ),
          }
        : {})}
      {...(card.image
        ? {
            portrait: (
              <ShopMediaImage
                src={card.image}
                alt=""
                monogram={marketingArtistInitials(card.name)}
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
