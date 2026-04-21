"use client";

import { getSocket } from "@/lib/socket";
import { LiveTicker } from "@auction/ui";
import { useEffect, useState } from "react";

type Props = {
  /** Seed from `GET /admin/metrics/live` */
  initialBidsPerMinute: number;
  /** Active lot ids to join for saleroom pulse (capped client-side). */
  activeLotIds: readonly string[];
};

/**
 * Subscribes to a capped set of lot rooms and pulses the ticker on each `bidUpdate`.
 */
export function AdminLiveBidActivity({ initialBidsPerMinute, activeLotIds }: Props) {
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    const socket = getSocket();
    const capped = activeLotIds.slice(0, 12);
    const onBid = () => setExtra((n) => n + 1);
    for (const lotId of capped) {
      socket.emit("joinLot", { lotId }, () => {});
    }
    socket.on("bidUpdate", onBid);
    return () => {
      socket.off("bidUpdate", onBid);
      for (const lotId of capped) {
        socket.emit("leaveLot", { lotId }, () => {});
      }
    };
  }, [activeLotIds]);

  const suffix = extra > 0 ? ` (+${extra} live)` : "";
  return (
    <LiveTicker
      label="Bids / min (Redis) + live"
      value={
        <span className="tabular-nums">
          {initialBidsPerMinute}
          <span className="font-body text-xs text-lot-orange">{suffix}</span>
        </span>
      }
    />
  );
}
