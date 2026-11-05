import { hangLabelModel } from "@/lib/hang/hang-label";
import type { HomeLotCard } from "@/lib/home-sections/types";
import { lotCardLineModel } from "@/lib/lot-card/lot-card-line";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPath } from "@/lib/seo/url";
import { type LotMediaTreatmentIndex, lotMediaTreatment } from "@auction/domain";
import type { Lot, Sale } from "@auction/types";

export type ArtistNames = Readonly<Record<string, string>>;

/**
 * A lot as a home card. The price and clock are the shared card line, so a lot reads the same
 * here as on its sale page and its own page.
 */
export function homeLotCard(
  lot: Lot,
  sale: Pick<Sale, "buyerPremiumTiers"> | null,
  artistNames: ArtistNames,
  now: Date,
  treatments: LotMediaTreatmentIndex = {},
): HomeLotCard {
  const label = hangLabelModel(lot, { sale, now });
  return {
    id: lot.id,
    href: lotPath(lot),
    title: lot.title,
    artistName: (lot.artistId ? artistNames[lot.artistId] : undefined) ?? null,
    imageUrl: lot.images[0] ?? null,
    displayStyle: lotMediaTreatment(lot, treatments).style,
    watchable: lot.status === "active" || lot.status === "scheduled",
    details: [label.eyebrow],
    estimate: lotEstimateLine(lot),
    line: lotCardLineModel(lot, now, { premiumTiers: sale?.buyerPremiumTiers ?? null }),
  };
}
