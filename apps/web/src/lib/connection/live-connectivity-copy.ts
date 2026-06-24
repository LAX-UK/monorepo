/** Scoped copy for hydrate failure notices shown in live connectivity banners. */
export const LIVE_CONNECTIVITY_COPY = {
  lotHydrateFailed:
    "Could not refresh live prices — showing last known bids until the connection recovers.",
  saleroomHydrateFailed:
    "Could not refresh saleroom status — on-block lot info may be stale until the connection recovers.",
} as const;

export type LiveConnectivityScope = "bidding" | "saleroom" | "hybrid";

export type SocketCopyScope = Exclude<LiveConnectivityScope, "hybrid">;

type NonLiveConnectionState = "offline" | "connecting" | "degraded";

/** Socket-state copy for the bidding / lot bid panel surfaces. */
export const BIDDING_SOCKET_MESSAGES: Record<NonLiveConnectionState, string> = {
  offline: "No connection — live bidding is paused. Prices may be outdated.",
  connecting: "Reconnecting to the saleroom…",
  degraded:
    "Slow connection — live updates may be delayed. You can still place bids; we refresh the price before you confirm.",
};

/** Socket-state copy for saleroom catalog and staff surfaces. */
export const SALEROOM_SOCKET_MESSAGES: Record<NonLiveConnectionState, string> = {
  offline: "No connection — saleroom updates are paused.",
  connecting: "Reconnecting to the saleroom…",
  degraded: "Slow connection — saleroom updates may be delayed.",
};

export function socketMessageForScope(
  scope: SocketCopyScope,
  state: NonLiveConnectionState,
): string {
  return scope === "bidding" ? BIDDING_SOCKET_MESSAGES[state] : SALEROOM_SOCKET_MESSAGES[state];
}

/** Bidding-scoped socket message for merge-connection-status and legacy callers. */
export function biddingConnectionMessage(state: NonLiveConnectionState | "live"): string | null {
  if (state === "live") return null;
  return BIDDING_SOCKET_MESSAGES[state];
}

export function lotHydrateNoticeId(lotId: string): string {
  return `lot-hydrate-failed-${lotId}`;
}

export function saleroomHydrateNoticeId(saleId: string): string {
  return `saleroom-hydrate-failed-${saleId}`;
}

/** Maps notice id prefixes to the banner scope that should display them. */
export function noticeScopeForId(id: string): SocketCopyScope | null {
  if (id.startsWith("lot-hydrate-")) return "bidding";
  if (id.startsWith("saleroom-hydrate-")) return "saleroom";
  return null;
}
