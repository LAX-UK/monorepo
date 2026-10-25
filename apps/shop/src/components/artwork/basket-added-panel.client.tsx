"use client";

import { ShopMediaImage } from "@/components/media/shop-media-image";
import { ShopCommerceButton } from "@/components/shop-commerce-button";
import { SHOP_MEDIA_LABELS } from "@/lib/media/shop-media-labels";
import { MarketingCheckIcon } from "@auction/marketing-ui";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@auction/ui/components/sheet";

export type BasketAddedItem = {
  title: string;
  artistName: string;
  imageUrl: string | null;
  editionSize: string;
  priceLabel: string;
};

/**
 * Confirms an edition went into the basket: a small panel under the header (non-modal, so the
 * page stays usable), naming the item, with "View basket" and "Continue shopping". Escape, a click
 * elsewhere or "Continue shopping" closes it.
 */
export function BasketAddedPanel({
  open,
  onOpenChange,
  item,
  onClosed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BasketAddedItem;
  /** Where focus goes when the panel closes. */
  onClosed: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent
        side="right"
        className="shop-added-panel"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onClosed();
        }}
      >
        <div className="shop-added-panel__heading">
          <MarketingCheckIcon className="shop-added-panel__tick" />
          <SheetTitle className="shop-added-panel__title">Added to your basket</SheetTitle>
        </div>
        <SheetDescription className="sr-only">
          {item.title} by {item.artistName}, {item.priceLabel}.
        </SheetDescription>
        <div className="shop-added-panel__item">
          <div className="shop-added-panel__thumb">
            <ShopMediaImage
              src={item.imageUrl}
              alt=""
              label={SHOP_MEDIA_LABELS.artwork}
              sizes="4.5rem"
              className="absolute inset-0 size-full"
              imgClassName="object-contain"
            />
          </div>
          <div className="shop-added-panel__text">
            <p className="shop-added-panel__item-title">{item.title}</p>
            <p className="shop-added-panel__meta">{item.artistName}</p>
            <p className="shop-added-panel__meta">{item.editionSize}</p>
          </div>
          <p className="shop-added-panel__price">{item.priceLabel}</p>
        </div>
        <div className="shop-added-panel__actions">
          <ShopCommerceButton href="/basket" scale="standard" className="w-full">
            View basket
          </ShopCommerceButton>
          <ShopCommerceButton
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            Continue shopping
          </ShopCommerceButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
