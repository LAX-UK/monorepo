import { ART_PRODUCT_DOORS_SECTION } from "@/lib/product-doors/art-product-doors.vm";
import { type MarketingProductDoorVm, MarketingProductDoors } from "@auction/marketing-ui";

/** "Across LAX": the one product-doors section lax.art shows, on the home page and Art Hub. */
export function ArtProductDoors({ doors }: { doors: readonly MarketingProductDoorVm[] }) {
  return (
    <MarketingProductDoors
      title={ART_PRODUCT_DOORS_SECTION.title}
      description={ART_PRODUCT_DOORS_SECTION.description}
      doors={doors}
      data-testid="art-product-doors"
    />
  );
}
