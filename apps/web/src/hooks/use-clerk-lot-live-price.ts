"use client";

import { formatBidChannelLabel } from "@/lib/bid/bid-channel-label";
import type { AdminPaddleRosterEntry } from "@/lib/data/http/admin.server";
import { parseBidUpdateEvent } from "@/lib/realtime/parse-bid-update";
import { getSocket } from "@/lib/socket";
import { useEffect, useMemo, useState } from "react";

export type ClerkLotLiveBidState = {
  currentPrice: string;
  bidCount: number | null;
  leaderUserId: string | null;
  leaderAmount: string | null;
  placedVia: string | null;
  leaderLabel: string | null;
};

const EMPTY_STATE: ClerkLotLiveBidState = {
  currentPrice: "0.00",
  bidCount: null,
  leaderUserId: null,
  leaderAmount: null,
  placedVia: null,
  leaderLabel: null,
};

function resolveLeaderLabel(params: {
  leaderUserId: string | null;
  placedVia: string | null;
  paddleRoster: readonly AdminPaddleRosterEntry[];
}): string | null {
  const channel = formatBidChannelLabel(params.placedVia);
  if (!params.leaderUserId) {
    return channel;
  }
  const rosterMatch = params.paddleRoster.find((entry) => entry.userId === params.leaderUserId);
  if (rosterMatch) {
    const paddle = `Paddle ${rosterMatch.paddleNumber}`;
    const name = rosterMatch.displayName?.trim();
    return name ? `${paddle} · ${name}` : paddle;
  }
  const shortId = params.leaderUserId.slice(0, 8);
  return channel ? `${channel} · ${shortId}` : shortId;
}

/** Live bid summary for the clerk on-block panel (Socket.IO lot room). */
export function useClerkLotLiveBidState(
  lotId: string | null,
  initialPrice: string,
  paddleRoster: readonly AdminPaddleRosterEntry[] = [],
): ClerkLotLiveBidState {
  const [state, setState] = useState<ClerkLotLiveBidState>({
    ...EMPTY_STATE,
    currentPrice: initialPrice,
  });

  useEffect(() => {
    setState({
      ...EMPTY_STATE,
      currentPrice: initialPrice,
    });
    if (!lotId) return;

    const socket = getSocket();

    const onBidUpdate = (raw: unknown) => {
      const mapped = parseBidUpdateEvent(raw);
      if (mapped?.lotId !== lotId) return;
      setState((prev) => ({
        currentPrice: mapped.currentPrice,
        bidCount: mapped.bidCount ?? prev.bidCount,
        leaderUserId: mapped.placedByUserId ?? mapped.bidderId ?? null,
        leaderAmount: mapped.amount,
        placedVia: mapped.placedVia ?? null,
        leaderLabel: null,
      }));
    };

    const join = () => {
      socket.emit("joinLot", { lotId }, () => {});
    };

    join();
    socket.on("bidUpdate", onBidUpdate);
    socket.on("connect", join);

    return () => {
      socket.off("bidUpdate", onBidUpdate);
      socket.off("connect", join);
      socket.emit("leaveLot", { lotId }, () => {});
    };
  }, [initialPrice, lotId]);

  return useMemo(
    () => ({
      ...state,
      leaderLabel: resolveLeaderLabel({
        leaderUserId: state.leaderUserId,
        placedVia: state.placedVia,
        paddleRoster,
      }),
    }),
    [paddleRoster, state],
  );
}

export function minNextBidAmount(currentPrice: string, minBidIncrement: string): number {
  const cur = Number.parseFloat(currentPrice);
  const inc = Number.parseFloat(minBidIncrement);
  const safeCur = Number.isFinite(cur) ? cur : 0;
  const safeInc = Number.isFinite(inc) && inc > 0 ? inc : 0.01;
  return safeCur + safeInc;
}
