import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { CatalogueCategoryCardVm } from "@/lib/catalogue/catalogue-category-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCardMedia, MarketingCardShell } from "@auction/marketing-ui";
import Link from "next/link";

type CategoryCardProps = {
  card: CatalogueCategoryCardVm;
};

export function CategoryCard({ card }: CategoryCardProps) {
  return (
    <MarketingCardShell asChild className="shop-home__category-card shop-focus-ring">
      <Link href={card.href} aria-label={card.label}>
        <MarketingCardMedia className="shop-home__category-image shop-home__card-media">
          <ShopMediaImage
            src={card.image}
            alt={card.imageAlt}
            label={SHOP_MEDIA_LABELS.category}
            aspect={[4, 5]}
            sizes="(min-width: 64rem) 25vw, 70vw"
            className="absolute inset-0 size-full object-cover"
          />
        </MarketingCardMedia>
        <div className="shop-home__category-copy">
          <h3 className="shop-home__category-label">{card.label}</h3>
        </div>
      </Link>
    </MarketingCardShell>
  );
}
