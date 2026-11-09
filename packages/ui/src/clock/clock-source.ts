/** Smallest correction worth applying; anything under this is ignored so the clock never visibly steps. */
export const CLOCK_CORRECTION_THRESHOLD_MS = 250;

export type ClockSource = {
  /** The server's time in milliseconds as best we know it. Never goes backwards. */
  now(): number;
  /**
   * Starts the clock from a server reading taken at page render. Used until the first
   * measurement lands; ignored afterwards.
   */
  seedProvisional(serverMs: number): void;
  /**
   * A measurement: the server's clock read `serverMs` at the moment this device's monotonic
   * clock read `monotonicMs`. Corrections under {@link CLOCK_CORRECTION_THRESHOLD_MS} are ignored.
   */
  applyMeasurement(serverMs: number, monotonicMs: number): void;
  /** Whether a measurement has landed yet. */
  isMeasured(): boolean;
};

export type ClockReaders = {
  /** Wall clock, used only to start the provisional offset. */
  wallNow(): number;
  /** Monotonic clock (`performance.now`), which a device clock change cannot move. */
  monotonicNow(): number;
};

const browserReaders: ClockReaders = {
  wallNow: () => Date.now(),
  monotonicNow: () => (typeof performance !== "undefined" ? performance.now() : Date.now()),
};

/**
 * The server-aligned clock. It reads time from the monotonic clock plus an offset, so changing
 * the device clock mid-session changes nothing. A correction that would move time backwards
 * holds the clock still until the server catches up, so a countdown never counts up.
 */
export function createClockSource(readers: ClockReaders = browserReaders): ClockSource {
  // serverTime = monotonic + anchor
  let anchor = readers.wallNow() - readers.monotonicNow();
  let measured = false;
  let seeded = false;
  let last = Number.NEGATIVE_INFINITY;

  const read = () => {
    const value = readers.monotonicNow() + anchor;
    // A backwards correction freezes the clock rather than letting a countdown count up.
    if (value > last) last = value;
    return last;
  };

  return {
    now: read,
    seedProvisional(serverMs) {
      if (measured || seeded || !Number.isFinite(serverMs)) return;
      seeded = true;
      anchor = serverMs - readers.monotonicNow();
    },
    applyMeasurement(serverMs, monotonicMs) {
      if (!Number.isFinite(serverMs) || !Number.isFinite(monotonicMs)) return;
      const nextAnchor = serverMs - monotonicMs;
      const correction = nextAnchor - anchor;
      measured = true;
      if (Math.abs(correction) < CLOCK_CORRECTION_THRESHOLD_MS) return;
      anchor = nextAnchor;
    },
    isMeasured: () => measured,
  };
}
