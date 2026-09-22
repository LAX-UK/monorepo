import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { HomeOriginalCard } from "@/content/home-marketing";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCardMedia, MarketingCardShell } from "@auction/marketing-ui";
import { DotStatusPill } from "@auction/ui/components/dot-status-pill";
import Link from "next/link";

type OriginalCardProps = {
  card: HomeOriginalCard;
};

export function OriginalCard({ card }: OriginalCardProps) {
  const body = (
    <>
      <MarketingCardMedia className="shop-home__original-image shop-home__card-media">
        <ShopMediaImage
          src={card.image}
          alt={card.imageAlt}
          label={SHOP_MEDIA_LABELS.artwork}
          aspect={[4, 5]}
          sizes="(min-width: 64rem) 25vw, 70vw"
          className="absolute inset-0 size-full"
        />
      </MarketingCardMedia>
      <div className="shop-home__original-body">
        <div className="shop-home__original-meta">
          <h3 className="shop-home__original-title">{card.title}</h3>
          {card.status ? (
            <div className="shop-home__original-status">
              <DotStatusPill label={card.status.label} tone={card.status.tone} />
            </div>
          ) : null}
          <p className="shop-home__original-artist">{card.artistLine}</p>
          <p className="shop-home__original-dimensions">{card.dimensions}</p>
        </div>
        <p className="shop-home__availability-note">{card.availabilityNote}</p>
      </div>
    </>
  );

  return (
    <MarketingCardShell asChild className="shop-home__original-card shop-focus-ring">
      <Link href={card.href} aria-label={`${card.title} by ${card.artistLine}`}>
        {body}
      </Link>
    </MarketingCardShell>
  );
}
