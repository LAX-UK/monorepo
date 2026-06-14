"use client";

import { BidHistory } from "@/components/sections/artwork/bid-history";
import { useLotBidHistory } from "@/lib/context/lot-bid-history-provider";

type Props = {
  lotId: string;
};

/** Live bid history for the left-column accordion (reads shared lot bid store). */
export function BidHistoryInAccordion({ lotId: _lotId }: Props) {
  const { entries } = useLotBidHistory();
  return <BidHistory entries={entries} compact hideHeading />;
}
