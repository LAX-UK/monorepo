import { ShopMediaImage } from "@/components/media/shop-media-image";
import type { CatalogueCategoryCardVm } from "@/lib/catalogue/catalogue-category-card.vm";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCategoryTile } from "@auction/marketing-ui";

type CategoryCardProps = {
  card: CatalogueCategoryCardVm;
};

export function CategoryCard({ card }: CategoryCardProps) {
  return (
    <MarketingCategoryTile
      href={card.href}
      label={card.label}
      className="shop-home__category-card shop-focus-ring"
      image={
        <ShopMediaImage
          src={card.image}
          alt=""
          label={SHOP_MEDIA_LABELS.category}
          aspect={[4, 5]}
          sizes="(min-width: 64rem) 25vw, 70vw"
          className="absolute inset-0 size-full object-cover"
        />
      }
    />
  );
}
