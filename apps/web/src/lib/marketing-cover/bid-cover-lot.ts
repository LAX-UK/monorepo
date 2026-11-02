import { hangLabelModel } from "@/lib/hang/hang-label";
import { lotPath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";
import type { BidCoverLot } from "./bid-cover.adapter";

/** "Current bid", "Sold for" and the like, as the lower-case phrase the credit line reads. */
function priceLine(lot: Lot, sale: Sale, now: Date): string | null {
  const { price } = hangLabelModel(lot, { sale, now });
  if (!price?.qualifier) return null;
  return `${price.qualifier.toLowerCase()} ${price.value}`;
}

/**
 * A lot as the cover credits and, without a cover photograph, hangs it on a plate. The picture
 * needs its stored size to be drawn whole; without one the lot is still credited but gives no plate.
 * `field` is the plate colour for this lot's photograph, already chosen by the caller.
 */
export function toBidCoverLot(lot: Lot, sale: Sale, now: Date, field: string): BidCoverLot {
  const src = lot.images[0];
  const asset = lot.imageAssets?.[0];
  const sized = Boolean(src && asset?.width && asset?.height);
  return {
    id: lot.id,
    href: lotPath(lot),
    label: hangLabelModel(lot, { sale, now }).eyebrow,
    title: lot.title,
    priceLine: priceLine(lot, sale, now),
    image:
      src && sized && asset?.width && asset?.height
        ? {
            src,
            width: asset.width,
            height: asset.height,
            ...(asset.blurDataURL ? { blurDataURL: asset.blurDataURL } : {}),
            field,
          }
        : null,
  };
}
