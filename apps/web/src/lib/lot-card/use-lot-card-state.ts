"use client";

import { AuthSessionContext } from "@/lib/auth/auth-session-provider";
import { useQuery } from "@tanstack/react-query";
import { useContext } from "react";
import type { LotCardState } from "./lot-card-states";
import { fetchLotCardState } from "./lot-card-states.client";

export type LotCardStateRead = {
  /** The viewer is signed in: only then does a card reserve room for a line. */
  signedIn: boolean;
  /** The first read has not landed yet. */
  loading: boolean;
  /** `null` when the viewer has no bid on the lot, or it could not be read. */
  state: LotCardState | null;
};

/**
 * Where the signed-in viewer stands on a card's lot. A visitor costs no request and sees nothing
 * extra. The read follows the page's render, so the card paints first and the line fills in.
 */
export function useLotCardState(lotId: string): LotCardStateRead {
  const signedIn = useContext(AuthSessionContext)?.user != null;
  const query = useQuery({
    queryKey: ["lot-card-state", lotId],
    queryFn: () => fetchLotCardState(lotId),
    enabled: signedIn,
    staleTime: 15_000,
  });
  return {
    signedIn,
    loading: signedIn && query.isPending,
    state: signedIn ? (query.data ?? null) : null,
  };
}
