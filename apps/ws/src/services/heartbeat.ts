import type { Server } from "socket.io";

/** Matches `LOT_LIVE_EVENTS.heartbeat` in the shared contract. */
const HEARTBEAT_EVENT = "heartbeat";

export const HEARTBEAT_INTERVAL_MS = 15_000;

/**
 * Tells every connected client the gateway is alive and what time it is. A page that stops
 * hearing it knows its connection is stale and says so, instead of guessing from latency.
 * Returns a function that stops the beat.
 */
export function startHeartbeat(
  io: Pick<Server, "emit">,
  options: { intervalMs?: number; now?: () => Date } = {},
): () => void {
  const intervalMs = options.intervalMs ?? HEARTBEAT_INTERVAL_MS;
  const now = options.now ?? (() => new Date());
  const timer = setInterval(() => {
    io.emit(HEARTBEAT_EVENT, { serverNow: now().toISOString() });
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
