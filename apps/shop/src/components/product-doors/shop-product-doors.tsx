import { SHOP_HOME_CONTENT } from "@/content/home/shop-home-content";
import { type MarketingProductDoorVm, MarketingProductDoors } from "@auction/marketing-ui";

/** "Across LAX": lax.art and LAX Bid, as every LAX product shows its siblings. */
export function ShopProductDoors({ doors }: { doors: readonly MarketingProductDoorVm[] }) {
  return (
    <MarketingProductDoors
      title={SHOP_HOME_CONTENT.doors.title}
      description={SHOP_HOME_CONTENT.doors.description}
      doors={doors}
      // The home page container already gives the gutter.
      className="shop-product-doors px-0 md:px-0 lg:px-0"
      data-testid="shop-product-doors"
    />
  );
}
