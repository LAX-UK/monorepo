import {
  type AccordionBlock,
  mapLotToAccordionBlocks,
} from "@/components/sections/artwork/artwork-view-models";
import type { BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { BidHistoryInAccordion } from "@/components/sections/artwork/redesign/bid-history-in-accordion";
import { LotDetailsInline } from "@/components/sections/artwork/redesign/lot-details-inline";
import { getMinNextBidAmount } from "@/lib/bid/lot-min-bid";
import type { PublicUser } from "@/lib/data/contracts";
import type { Lot } from "@auction/types";

/** Marketing accordion plus “Lot details” and “Bid history” (rich nodes).
 * Use from the artwork page (RSC); `BidHistoryInAccordion` is a client child.
 */
export function buildArtworkPageAccordionBlocks(args: {
  lot: Lot;
  artist: PublicUser | null;
  initialHistory: BidHistoryEntry[];
}): AccordionBlock[] {
  const { lot, artist, initialHistory } = args;
  const minNext = getMinNextBidAmount(lot, lot.currentPrice).toFixed(2);
  const saleEndLocal = new Date(lot.endTime).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return [
    ...mapLotToAccordionBlocks(lot, artist),
    {
      id: "lot-details",
      title: "Lot details",
      hidden: false,
      contentNode: (
        <LotDetailsInline
          lot={lot}
          minNextBid={minNext}
          saleEndLocalLabel={saleEndLocal}
          currentPrice={lot.currentPrice}
          variant="accordion"
        />
      ),
    },
    {
      id: "bid-history",
      title: "Bid history",
      hidden: false,
      contentNode: <BidHistoryInAccordion lotId={lot.id} initialHistory={initialHistory} />,
    },
  ];
}
