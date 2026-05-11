import type { ConnectionStatus, RealtimeHealthPort } from "@/lib/realtime/contracts";
import { getSocket } from "@/lib/socket";

const RTT_EMA_ALPHA = 0.3;
const DEFAULT_PROBE_MS = 5000;
const ACK_TIMEOUT_MS = 2000;

let singleton: RealtimeHealthPort | null = null;

function parseProbeIntervalMs(): number {
  const raw = process.env.NEXT_PUBLIC_WS_LATENCY_PROBE_MS;
  if (!raw) return DEFAULT_PROBE_MS;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 2000 && n <= 60_000 ? n : DEFAULT_PROBE_MS;
}

function createSocketHealthAdapterImpl(): RealtimeHealthPort {
  const socket = getSocket();
  const listeners = new Set<(s: ConnectionStatus) => void>();

  let status: ConnectionStatus = {
    state: socket.connected ? "online" : "connecting",
    rttMs: null,
    lastSampleAt: null,
    lastBidPropagationMs: null,
  };

  /** Client clock ahead of server by this many ms (estimate from last probe). */
  let clientAheadMs = 0;
  let rttEmaMs: number | null = null;
  let activeLotId: string | null = null;

  let probeIntervalId: ReturnType<typeof setInterval> | null = null;
  let visibilityHandler: (() => void) | null = null;

  function emit() {
    for (const l of listeners) l({ ...status });
  }

  function setState(partial: Partial<ConnectionStatus>) {
    status = { ...status, ...partial };
    emit();
  }

  function onBidUpdate(payload: unknown) {
    if (!payload || typeof payload !== "object") return;
    const o = payload as Record<string, unknown>;
    const lotId =
      typeof o.lotId === "string" ? o.lotId : typeof o.auctionId === "string" ? o.auctionId : null;
    if (!lotId || !activeLotId || lotId !== activeLotId) return;
    const emittedAt = o.emittedAt;
    if (typeof emittedAt !== "number" || !Number.isFinite(emittedAt)) return;
    const raw = Date.now() - emittedAt;
    const corrected = Math.max(0, raw - clientAheadMs);
    setState({ lastBidPropagationMs: corrected });
  }

  function runProbe() {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    if (!socket.connected) return;

    const clientSentAt = Date.now();
    const t0 = performance.now();

    socket
      .timeout(ACK_TIMEOUT_MS)
      .emit("latencyProbe", { clientNow: clientSentAt }, (err: unknown, ack: unknown) => {
        const t1 = performance.now();
        if (err) {
          setState({ state: "offline", lastSampleAt: Date.now() });
          return;
        }
        const rttMs = t1 - t0;
        rttEmaMs =
          rttEmaMs == null ? rttMs : RTT_EMA_ALPHA * rttMs + (1 - RTT_EMA_ALPHA) * rttEmaMs;

        const ackObj = ack as { ok?: boolean; serverNow?: number } | null;
        const serverNow =
          ackObj && typeof ackObj.serverNow === "number" && Number.isFinite(ackObj.serverNow)
            ? ackObj.serverNow
            : null;

        if (serverNow != null) {
          const midpointClientWall = clientSentAt + rttMs / 2;
          clientAheadMs = midpointClientWall - serverNow;
        }

        setState({
          state: "online",
          rttMs: rttEmaMs,
          lastSampleAt: Date.now(),
        });
      });
  }

  function startProbes() {
    if (probeIntervalId != null) return;
    const ms = parseProbeIntervalMs();
    probeIntervalId = setInterval(runProbe, ms);
    void runProbe();
  }

  function stopProbes() {
    if (probeIntervalId != null) {
      clearInterval(probeIntervalId);
      probeIntervalId = null;
    }
  }

  socket.on("connect", () => {
    setState({ state: "online" });
    startProbes();
  });

  socket.on("disconnect", () => {
    stopProbes();
    setState({ state: "offline", rttMs: null });
  });

  socket.io?.on("reconnect_attempt", () => {
    setState({ state: "connecting" });
  });

  socket.on("bidUpdate", onBidUpdate);

  if (typeof document !== "undefined") {
    visibilityHandler = () => {
      if (document.visibilityState === "visible" && socket.connected) void runProbe();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
  }

  if (socket.connected) startProbes();

  return {
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...status });
      return () => {
        listeners.delete(listener);
      };
    },
    probe() {
      void runProbe();
    },
    setBidPropagationLotId(lotId) {
      activeLotId = lotId;
    },
  };
}

/** Shared health port bound to the singleton Socket.IO client. */
export function createSocketHealthAdapter(): RealtimeHealthPort {
  if (!singleton) singleton = createSocketHealthAdapterImpl();
  return singleton;
}

/** Clears singleton so the next `createSocketHealthAdapter()` attaches a fresh listener graph (Vitest). */
export function resetSocketHealthAdapterForTests(): void {
  singleton = null;
}
