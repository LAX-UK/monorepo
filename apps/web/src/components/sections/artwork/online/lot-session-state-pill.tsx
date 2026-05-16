"use client";

import { LotStatePill } from "@/components/sections/artwork/online/lot-state-pill";
import type { Lot, Sale } from "@auction/types";

type LotPick = Pick<
  Lot,
  "status" | "startTime" | "endTime" | "winnerId" | "reservePrice" | "currentPrice" | "id"
>;
type SalePick = Pick<Sale, "status" | "deliveryMode"> | null;

type Props = {
  lot: LotPick;
  sale: SalePick;
  initialNowMs?: number;
};

/** Sticky header pill; countdown hidden below `lg` (mobile sticky bar owns the timer). */
export function LotSessionStatePill({ lot, sale, initialNowMs }: Props) {
  return (
    <LotStatePill
      lot={lot}
      sale={sale}
      hideCountdownOnMobile
      {...(initialNowMs !== undefined ? { initialNowMs } : {})}
    />
  );
}
