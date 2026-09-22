import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { CatalogueArtistCardVm } from "@/lib/catalogue/catalogue-artist-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCardMedia, MarketingCardShell } from "@auction/marketing-ui";
import Link from "next/link";

type ArtistCardProps = {
  card: CatalogueArtistCardVm;
};

export function ArtistCard({ card }: ArtistCardProps) {
  return (
    <MarketingCardShell asChild className="shop-home__artist-card shop-focus-ring">
      <Link href={card.href} aria-label={card.name}>
        <MarketingCardMedia className="shop-home__artist-image shop-home__card-media">
          <ShopMediaImage
            src={card.image}
            alt={card.imageAlt}
            label={SHOP_MEDIA_LABELS.artistPortrait}
            aspect={[4, 5]}
            sizes="(min-width: 64rem) 20vw, 60vw"
            className="absolute inset-0 size-full object-cover"
          />
        </MarketingCardMedia>
        <div className="shop-home__artist-copy">
          <h3 className="shop-home__artist-name">{card.name}</h3>
          <p className="shop-home__artist-discipline">{card.discipline}</p>
        </div>
      </Link>
    </MarketingCardShell>
  );
}
