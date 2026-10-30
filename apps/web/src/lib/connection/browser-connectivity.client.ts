import {
  type BrowserConnectivityPort,
  CONNECTIVITY_PROBE_PATH,
  CONNECTIVITY_PROBE_TIMEOUT_MS,
  type ConnectivityProbe,
  createNavigatorNetworkHint,
  createVerifiedConnectivityPort,
} from "./browser-connectivity";

/** A no-store GET of our health route; any answer from the server counts as reachable. */
export function createHealthProbe(fetchImpl: typeof fetch): ConnectivityProbe {
  return async () => {
    try {
      await fetchImpl(CONNECTIVITY_PROBE_PATH, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(CONNECTIVITY_PROBE_TIMEOUT_MS),
      });
      return true;
    } catch {
      return false;
    }
  };
}

let defaultPort: BrowserConnectivityPort | null = null;

/** The app's one connectivity port: the browser's hint, confirmed against our server. */
export function getBrowserConnectivityPort(): BrowserConnectivityPort {
  if (!defaultPort) {
    defaultPort = createVerifiedConnectivityPort({
      hint: createNavigatorNetworkHint(),
      probe: createHealthProbe((input, init) => fetch(input, init)),
    });
  }
  return defaultPort;
}
