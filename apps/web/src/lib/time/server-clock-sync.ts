import type { ServerTimeSource } from "./server-time-source";

/** The part of the shared clock the sync feeds. */
export type SyncedClock = {
  now(): number;
  applyMeasurement(serverMs: number, monotonicMs: number): void;
};

export type SyncTrigger = "start" | "visible" | "interval" | "reconnect" | "live-event";

export type ServerClockSyncOptions = {
  source: ServerTimeSource;
  clock: SyncedClock;
  /** `performance.now()`: the clock a device clock change cannot move. */
  monotonicNow: () => number;
  /** Round trips measured per sync; the quickest wins. */
  samples?: number;
  /** A round trip slower than this tells us little about where the server's clock is. */
  maxRoundTripMs?: number;
  /** Resync on tab return only after being hidden this long. */
  hiddenResyncAfterMs?: number;
  resyncIntervalMs?: number;
  /** A live event that puts the server this far ahead of our clock triggers a resync. */
  liveEventDriftMs?: number;
  /** Live events trigger at most one resync per this interval. */
  liveEventMinGapMs?: number;
  onFailure?: (error: unknown) => void;
};

export type ServerClockSync = {
  /** One measurement now: the quickest of a few round trips. Resolves when applied or given up. */
  resync(trigger: SyncTrigger): Promise<void>;
  /** The page learned the server's time from a live event. Resyncs if our clock is behind. */
  observeServerNow(serverMs: number): void;
  /** The live connection came back. */
  notifyReconnected(): void;
  /** Starts the first sync, the tab-return watch and the periodic resync. Returns the stop. */
  start(env: SyncEnvironment): () => void;
};

/** The browser features the sync listens to, passed in so tests need no DOM. */
export type SyncEnvironment = {
  isVisible(): boolean;
  onVisibilityChange(callback: () => void): () => void;
  setInterval(callback: () => void, ms: number): () => void;
  /** Time the tab went hidden is read from here. */
  monotonicNow(): number;
};

/**
 * Measures how far the shared clock is from the Bid API's clock, the one that accepts or rejects a
 * bid and closes a lot. Each round trip gives `server time + half the round trip` at the moment
 * the answer arrived on the monotonic clock; the quickest round trip is the most trustworthy.
 * A failed sync changes nothing: the clock keeps its provisional offset and tries again at the
 * next trigger. The server stays the judge either way, so a wrong clock can mislead a bidder
 * but never let a late bid through.
 */
export function createServerClockSync(options: ServerClockSyncOptions): ServerClockSync {
  const samples = options.samples ?? 3;
  const maxRoundTripMs = options.maxRoundTripMs ?? 2_000;
  const hiddenResyncAfterMs = options.hiddenResyncAfterMs ?? 60_000;
  const resyncIntervalMs = options.resyncIntervalMs ?? 10 * 60_000;
  const liveEventDriftMs = options.liveEventDriftMs ?? 250;
  const liveEventMinGapMs = options.liveEventMinGapMs ?? 30_000;

  let inflight: Promise<void> | null = null;
  let lastLiveEventResyncAt = Number.NEGATIVE_INFINITY;

  async function measure(): Promise<void> {
    let best: { serverMs: number; atMonotonicMs: number; roundTripMs: number } | null = null;
    for (let i = 0; i < samples; i++) {
      const sentAt = options.monotonicNow();
      let serverMs: number;
      try {
        serverMs = await options.source.readServerNowMs();
      } catch (error) {
        options.onFailure?.(error);
        continue;
      }
      const receivedAt = options.monotonicNow();
      const roundTripMs = receivedAt - sentAt;
      if (!(roundTripMs >= 0) || roundTripMs > maxRoundTripMs) continue;
      if (!best || roundTripMs < best.roundTripMs) {
        best = { serverMs: serverMs + roundTripMs / 2, atMonotonicMs: receivedAt, roundTripMs };
      }
    }
    if (best) options.clock.applyMeasurement(best.serverMs, best.atMonotonicMs);
  }

  const sync: ServerClockSync = {
    resync(_trigger) {
      inflight ??= measure().finally(() => {
        inflight = null;
      });
      return inflight;
    },
    observeServerNow(serverMs) {
      if (!Number.isFinite(serverMs)) return;
      if (serverMs - options.clock.now() <= liveEventDriftMs) return;
      const at = options.monotonicNow();
      if (at - lastLiveEventResyncAt < liveEventMinGapMs) return;
      lastLiveEventResyncAt = at;
      void sync.resync("live-event");
    },
    notifyReconnected() {
      void sync.resync("reconnect");
    },
    start(env) {
      void sync.resync("start");
      let hiddenAt: number | null = env.isVisible() ? null : env.monotonicNow();
      const stopVisibility = env.onVisibilityChange(() => {
        if (!env.isVisible()) {
          hiddenAt = env.monotonicNow();
          return;
        }
        const wasHiddenFor = hiddenAt === null ? 0 : env.monotonicNow() - hiddenAt;
        hiddenAt = null;
        if (wasHiddenFor > hiddenResyncAfterMs) void sync.resync("visible");
      });
      const stopInterval = env.setInterval(() => {
        if (env.isVisible()) void sync.resync("interval");
      }, resyncIntervalMs);
      return () => {
        stopVisibility();
        stopInterval();
      };
    },
  };
  return sync;
}
