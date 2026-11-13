import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import { formatMoney } from "@/lib/format-currency";
import { lotEstimateLine } from "@/lib/lot-marketing-display";
import { lotPriceDisplay } from "@/lib/lot-price-display";
import { lotBuyerPremiumCopy } from "@/lib/lot/buyer-premium-copy";
import type { Lot, PublicLotView } from "@auction/types";
import { toLotCardTimingVM } from "@auction/validators";
import type { LotQuickLookEnrichment } from "./enrichment-types";

/**
 * Build enrichment payload from a full Lot record. The premium line is the one the lot charges
 * (`lotBuyerPremiumCopy`): the server's resolved premium, or the lot's own rate.
 */
export function lotQuickLookEnrichmentFromLot(lot: Lot | PublicLotView): LotQuickLookEnrichment {
  const est = lotEstimateLine(lot);
  const price = lotPriceDisplay(lot);
  const { startTime, endTime } = toLotCardTimingVM(lot);
  const premiumHint = lotBuyerPremiumCopy(lot)?.sentence;

  const enrichment: LotQuickLookEnrichment = {
    medium: lot.medium,
    images: lot.images,
    status: lot.status,
    ...(startTime ? { startTime } : {}),
    ...(endTime ? { endTime } : {}),
    ...(lot.dimensions?.trim() ? { dimensions: lot.dimensions.trim() } : {}),
    ...(premiumHint ? { buyersPremiumHint: premiumHint } : {}),
  };

  if (est) {
    enrichment.estimateLabel = "Estimate";
    enrichment.estimateValue = est;
  }

  if (lot.status === "active") {
    enrichment.currentBidLabel = price.label;
    enrichment.currentBidValue = price.value;
    const minNext = getMinNextBidAmount(lot, lot.currentPrice);
    enrichment.minNextBidLabel = "Min. next bid";
    enrichment.minNextBidValue = formatMoney(minNext.toFixed(2));
  } else if (lot.status === "ended" || lot.status === "voided" || lot.status === "cancelled") {
    enrichment.currentBidLabel = price.label;
    enrichment.currentBidValue = price.value;
  }

  return enrichment;
}
