import type { ConnectionStatus } from "@/lib/realtime/contracts";

export type LiveConnectionState = "offline" | "connecting" | "degraded" | "live";

const DEGRADED_RTT_MS = 300;

export function mergeConnectionStatus(
  browserOnline: boolean,
  socket: ConnectionStatus,
): LiveConnectionState {
  if (!browserOnline || socket.state === "offline") return "offline";
  if (socket.state === "connecting" || socket.rttMs === null) return "connecting";
  if (socket.rttMs >= DEGRADED_RTT_MS) return "degraded";
  return "live";
}

export function liveConnectionMessage(state: LiveConnectionState): string | null {
  switch (state) {
    case "offline":
      return "No connection — live bidding is paused. Prices may be outdated.";
    case "connecting":
      return "Reconnecting to the saleroom…";
    case "degraded":
      return "Slow connection — live updates may be delayed. You can still place bids; we refresh the price before you confirm.";
    default:
      return null;
  }
}

/** True when HTTP bid submission is allowed (live or degraded socket). */
export function canSubmitBid(state: LiveConnectionState): boolean {
  return state === "live" || state === "degraded";
}

/** True when realtime latency is healthy (strict live feed). */
export function isRealtimeHealthy(state: LiveConnectionState): boolean {
  return state === "live";
}

/** @deprecated Use canSubmitBid — kept for gradual migration in tests. */
export function isLiveBiddingAllowed(state: LiveConnectionState): boolean {
  return canSubmitBid(state);
}
