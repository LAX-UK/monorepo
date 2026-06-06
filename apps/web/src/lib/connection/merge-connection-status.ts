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
      return "Slow connection — live bidding is paused until latency improves.";
    default:
      return null;
  }
}

export function isLiveBiddingAllowed(state: LiveConnectionState): boolean {
  return state === "live";
}
