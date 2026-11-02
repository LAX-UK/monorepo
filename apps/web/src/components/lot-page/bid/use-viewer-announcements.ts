"use client";

import { useAnnounce } from "@/components/lot-page/lot-announcer";
import { formatLotMoney } from "@/lib/lot-page/lot-money";
import { type LotPosition, positionAnnouncement } from "@auction/domain";
import { useEffect, useRef } from "react";

/**
 * Tells a screen reader when the viewer takes the lead or loses it. The first reading only sets
 * the baseline, so loading the page never announces anything.
 */
export function useViewerAnnouncements(input: {
  position: LotPosition;
  lotTitle: string;
  currentPrice: string;
  nextBid: string | null;
}): void {
  const announce = useAnnounce();
  const previous = useRef(input.position);
  const { position, lotTitle, currentPrice, nextBid } = input;

  useEffect(() => {
    const from = previous.current;
    previous.current = position;
    const message = positionAnnouncement({
      from,
      to: position,
      lotTitle,
      currentPrice,
      nextBid,
      format: { money: (amount) => formatLotMoney(amount) },
    });
    if (message) announce(message);
  }, [position, lotTitle, currentPrice, nextBid, announce]);
}
