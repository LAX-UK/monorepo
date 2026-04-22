"use client";

import { BidHistory, type BidHistoryEntry } from "@/components/sections/artwork/bid-history";
import { useLotRealtime } from "@/hooks/use-lot-realtime";
import { useCallback, useState } from "react";

const HISTORY_CAP = 20;

type Props = {
  lotId: string;
  initialHistory: BidHistoryEntry[];
};

/** Live bid history for the left-column accordion (second realtime subscription on same lot). */
export function BidHistoryInAccordion({ lotId, initialHistory }: Props) {
  const [history, setHistory] = useState<BidHistoryEntry[]>(initialHistory);

  const pushHistory = useCallback((entry: Omit<BidHistoryEntry, "at"> & { at?: number }) => {
    setHistory((h) =>
      [{ ...entry, at: entry.at ?? Date.now() }, ...h]
        .filter((e, i, arr) => arr.findIndex((x) => x.id === e.id) === i)
        .slice(0, HISTORY_CAP),
    );
  }, []);

  useLotRealtime(lotId, {
    onBidUpdate: (e) => {
      pushHistory({
        id: e.bidId,
        bidderId: e.bidderId,
        amount: e.amount,
      });
    },
  });

  return <BidHistory entries={history} compact hideHeading />;
}
