import { formatEstimateRange } from "@/lib/format-currency";
import type { Lot, PublicLotView } from "@auction/types";

export type LotSummarySeedVM = {
  title: string;
  kicker: string | null;
  estimateLine: string | null;
  sellerName: string;
  sellerHref: string;
  /** Public profile / OAuth image when available */
  sellerImageUrl: string | null;
};

/** Static hero copy; live bid/close values come from `ArtworkBidPanel` client state.
 */
export function mapLotToSummarySeed(
  lot: Lot | PublicLotView,
  sellerName: string,
  sellerHref: string,
  sellerImageUrl: string | null = null,
): LotSummarySeedVM {
  const est = lot.marketingDetails.estimate;
  const estimateLine = est ? formatEstimateRange(est) : null;
  return {
    title: lot.title,
    kicker: null,
    estimateLine,
    sellerName,
    sellerHref,
    sellerImageUrl,
  };
}
