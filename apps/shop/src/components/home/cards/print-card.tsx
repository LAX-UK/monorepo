import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { HomePrintCard } from "@/content/home-marketing";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCardMedia, MarketingCardShell } from "@auction/marketing-ui";
import Link from "next/link";

type PrintCardProps = {
  card: HomePrintCard;
};

export function PrintCard({ card }: PrintCardProps) {
  const body = (
    <>
      <MarketingCardMedia className="shop-home__print-image shop-home__card-media">
        <ShopMediaImage
          src={card.image}
          alt={card.imageAlt}
          label={SHOP_MEDIA_LABELS.artwork}
          aspect={[232, 264]}
          sizes="(min-width: 64rem) 232px, 42vw"
          className="h-full w-full"
        />
      </MarketingCardMedia>
      <div className="shop-home__print-copy">
        <h3 className="shop-home__print-title">{card.title}</h3>
        <p className="shop-home__print-artist">{card.artist}</p>
        <p className="shop-home__print-medium">{card.medium}</p>
      </div>
    </>
  );

  if (!card.href) {
    return (
      <MarketingCardShell interactive={false} className="shop-home__print-card">
        {body}
      </MarketingCardShell>
    );
  }

  return (
    <MarketingCardShell asChild className="shop-home__print-card shop-focus-ring">
      <Link href={card.href} aria-label={`${card.title} by ${card.artist}`}>
        {body}
      </Link>
    </MarketingCardShell>
  );
}
