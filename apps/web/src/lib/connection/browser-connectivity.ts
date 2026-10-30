/** Whether the visitor can reach LAX Bid, as the offline banner and live views read it. */
export type BrowserConnectivityPort = {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
};

/**
 * The browser's own network signal (`navigator.onLine` and the online/offline events). Only a
 * hint: Chromium on macOS can report offline after sleep, a Wi-Fi change or a VPN while the
 * network works, and then never fire "online".
 */
export type NetworkHint = {
  isOnline(): boolean;
  subscribe(listener: (online: boolean) => void): () => void;
};

/** Resolves true when our own server answered. */
export type ConnectivityProbe = () => Promise<boolean>;

export type VerifiedConnectivityOptions = {
  hint: NetworkHint;
  probe: ConnectivityProbe;
  /** Wait before the first check, so a blip during wake or a network switch shows nothing. */
  debounceMs?: number;
  /** Delays between checks while offline; the last one repeats. */
  retryDelaysMs?: readonly number[];
};

export const CONNECTIVITY_DEBOUNCE_MS = 2_500;
export const CONNECTIVITY_RETRY_DELAYS_MS = [5_000, 10_000, 20_000, 30_000] as const;
const PROBE_TIMEOUT_MS = 5_000;
/** Static, uncached and served by this app on every host. */
export const CONNECTIVITY_PROBE_PATH = "/api/health";

/**
 * Online unless our own server cannot be reached. An "offline" hint starts a check after a short
 * wait; the banner shows only if that check fails. While offline it checks again with growing
 * gaps, and any successful check (or an "online" event that a check confirms) clears it.
 */
export function createVerifiedConnectivityPort(
  options: VerifiedConnectivityOptions,
): BrowserConnectivityPort {
  const debounceMs = options.debounceMs ?? CONNECTIVITY_DEBOUNCE_MS;
  const retryDelays = options.retryDelaysMs ?? CONNECTIVITY_RETRY_DELAYS_MS;
  const listeners = new Set<(online: boolean) => void>();
  let online = true;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let stopHint: (() => void) | null = null;

  function setOnline(next: boolean) {
    if (next === online) return;
    online = next;
    for (const listener of listeners) listener(next);
  }

  function cancel() {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    generation += 1;
  }

  function schedule(delayMs: number) {
    cancel();
    const mine = generation;
    timer = setTimeout(() => {
      timer = null;
      void check(mine);
    }, delayMs);
  }

  async function check(mine: number) {
    const reachable = await options.probe().catch(() => false);
    if (mine !== generation) return;
    if (reachable) {
      attempt = 0;
      setOnline(true);
      return;
    }
    setOnline(false);
    const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)] ?? debounceMs;
    attempt += 1;
    schedule(delay);
  }

  function onHint(hintOnline: boolean) {
    if (hintOnline) {
      // Confirm at once: a real return clears the banner without waiting.
      if (!online) schedule(0);
      else cancel();
      return;
    }
    if (online && timer === null) {
      attempt = 0;
      schedule(debounceMs);
    }
  }

  function start() {
    stopHint = options.hint.subscribe(onHint);
    if (!options.hint.isOnline()) onHint(false);
  }

  function stop() {
    stopHint?.();
    stopHint = null;
    cancel();
  }

  return {
    isOnline: () => online,
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1) start();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stop();
      };
    },
  };
}

/** `navigator.onLine` and the window online/offline events. */
export function createNavigatorNetworkHint(): NetworkHint {
  return {
    isOnline() {
      if (typeof navigator === "undefined") return true;
      return navigator.onLine;
    },
    subscribe(listener) {
      if (typeof window === "undefined") return () => {};
      const onOnline = () => listener(true);
      const onOffline = () => listener(false);
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
      return () => {
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      };
    },
  };
}

/** A no-store GET of our health route; any answer from the server counts as reachable. */
export function createHealthProbe(fetchImpl: typeof fetch = fetch): ConnectivityProbe {
  return async () => {
    try {
      await fetchImpl(CONNECTIVITY_PROBE_PATH, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      });
      return true;
    } catch {
      return false;
    }
  };
}

let defaultPort: BrowserConnectivityPort | null = null;

export function getBrowserConnectivityPort(): BrowserConnectivityPort {
  if (!defaultPort) {
    defaultPort = createVerifiedConnectivityPort({
      hint: createNavigatorNetworkHint(),
      probe: createHealthProbe((input, init) => fetch(input, init)),
    });
  }
  return defaultPort;
}
