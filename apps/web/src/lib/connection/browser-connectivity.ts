import {
  type ConnectivityProbe,
  createHttpConnectivityProbe,
} from "@/lib/connection/connectivity-probe";

export type BrowserConnectivityPort = {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
};

/** Browser signals the port listens to. They are hints only: Chromium can report a false offline. */
export type ConnectivityHints = {
  reportsOnline(): boolean;
  addEventListener(type: "online" | "offline", handler: () => void): void;
  removeEventListener(type: "online" | "offline", handler: () => void): void;
};

export type BrowserConnectivityOptions = {
  probe: ConnectivityProbe;
  hints: ConnectivityHints | null;
  /** Wait before confirming an offline hint, so brief blips never show a banner. */
  confirmDelayMs?: number;
  /** First re-probe delay while offline; doubles up to maxRetryDelayMs. */
  initialRetryDelayMs?: number;
  maxRetryDelayMs?: number;
};

/**
 * Online unless a probe to our own origin fails. An offline hint (navigator.onLine or the
 * "offline" event) schedules a confirming probe after a short delay. While offline, the port
 * re-probes with backoff and recovers on any successful probe or "online" event.
 */
export function createBrowserConnectivityPort({
  probe,
  hints,
  confirmDelayMs = 2_500,
  initialRetryDelayMs = 5_000,
  maxRetryDelayMs = 60_000,
}: BrowserConnectivityOptions): BrowserConnectivityPort {
  const listeners = new Set<(online: boolean) => void>();
  let online = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let retryDelayMs = initialRetryDelayMs;
  let generation = 0;

  const setOnline = (next: boolean) => {
    if (next === online) return;
    online = next;
    for (const listener of listeners) listener(next);
  };

  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const schedule = (delayMs: number) => {
    clearTimer();
    timer = setTimeout(() => void runProbe(), delayMs);
  };

  const runProbe = async () => {
    timer = null;
    generation += 1;
    const run = generation;
    const reachable = await probe();
    if (run !== generation || listeners.size === 0) return;
    if (reachable) {
      retryDelayMs = initialRetryDelayMs;
      setOnline(true);
      return;
    }
    setOnline(false);
    schedule(retryDelayMs);
    retryDelayMs = Math.min(retryDelayMs * 2, maxRetryDelayMs);
  };

  const onOffline = () => {
    if (!online || timer !== null) return;
    schedule(confirmDelayMs);
  };

  const onOnline = () => {
    clearTimer();
    generation += 1;
    retryDelayMs = initialRetryDelayMs;
    setOnline(true);
  };

  const start = () => {
    if (!hints) return;
    hints.addEventListener("online", onOnline);
    hints.addEventListener("offline", onOffline);
    if (!hints.reportsOnline()) onOffline();
  };

  const stop = () => {
    clearTimer();
    generation += 1;
    hints?.removeEventListener("online", onOnline);
    hints?.removeEventListener("offline", onOffline);
  };

  return {
    isOnline: () => online,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        if (!listeners.delete(listener)) return;
        if (listeners.size === 0) stop();
      };
    },
  };
}

function windowHints(): ConnectivityHints | null {
  if (typeof window === "undefined") return null;
  return {
    reportsOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine),
    addEventListener: (type, handler) => window.addEventListener(type, handler),
    removeEventListener: (type, handler) => window.removeEventListener(type, handler),
  };
}

let defaultPort: BrowserConnectivityPort | null = null;

export function getBrowserConnectivityPort(): BrowserConnectivityPort {
  if (!defaultPort) {
    defaultPort = createBrowserConnectivityPort({
      probe: createHttpConnectivityProbe(),
      hints: windowHints(),
    });
  }
  return defaultPort;
}
