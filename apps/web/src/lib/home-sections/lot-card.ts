import { hangLabelModel } from "@/lib/hang/hang-label";
import type { HomeLotCard } from "@/lib/home-sections/types";
import { lotPath } from "@/lib/seo/url";
import type { Lot, Sale } from "@auction/types";

export type ArtistNames = Readonly<Record<string, string>>;

/**
 * A lot as a home card. The price is the wall label's: the sold price with the buyer's premium
 * for an ended lot, the bid or opening bid while it is live, the estimate before it opens.
 */
export function homeLotCard(
  lot: Lot,
  sale: Pick<Sale, "buyerPremiumTiers"> | null,
  artistNames: ArtistNames,
  now: Date,
): HomeLotCard {
  const label = hangLabelModel(lot, { sale, now });
  return {
    id: lot.id,
    href: lotPath(lot),
    title: lot.title,
    artistName: (lot.artistId ? artistNames[lot.artistId] : undefined) ?? null,
    imageUrl: lot.images[0] ?? null,
    watchable: lot.status === "active" || lot.status === "scheduled",
    details: [label.eyebrow],
    price: label.price
      ? { qualifier: label.price.qualifier ?? null, value: label.price.value }
      : null,
  };
}
