import { CatalogueGrid } from "@/components/catalogue-grid";
import { ShopSection } from "@/components/layout/shop-section";
import type { ArtworkMoreByVm } from "@/lib/artwork/artwork-product-page.vm";
import { FOCUS_RING } from "@auction/branding";
import { MarketingArrowRightIcon } from "@auction/marketing-ui";
import { cn } from "@auction/ui";
import Link from "next/link";

/**
 * "More by {artist}": their other editions, available first. One edition pairs with a text tile
 * that says there is one more; two or three make a row; four or more make a row of four and a
 * link to all of them.
 */
export function ArtworkMoreBy({ moreBy }: { moreBy: ArtworkMoreByVm }) {
  return (
    <ShopSection id="more-by" title={moreBy.title} className="shop-edition-more">
      <div
        className="shop-edition-more__row"
        data-count={moreBy.items.length + (moreBy.tile ? 1 : 0)}
      >
        <CatalogueGrid items={moreBy.items} titleLevel={3} className="shop-catalogue__list--four" />
        {moreBy.tile ? (
          <Link href={moreBy.tile.href} className={cn("shop-edition-more__tile", FOCUS_RING)}>
            {moreBy.tile.label}
            <MarketingArrowRightIcon className="shop-edition-more__tile-icon" />
          </Link>
        ) : null}
      </div>
      {moreBy.allLink ? (
        <Link href={moreBy.allLink.href} className={cn("shop-edition-more__all", FOCUS_RING)}>
          {moreBy.allLink.label}
          <MarketingArrowRightIcon className="shop-edition-more__tile-icon" />
        </Link>
      ) : null}
    </ShopSection>
  );
}
