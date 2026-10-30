/** Resolves true when our own origin answers; false on a network failure or timeout. */
export type ConnectivityProbe = () => Promise<boolean>;

type HttpConnectivityProbeOptions = {
  url?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Uncached same-origin HEAD request to the health route. Any HTTP response counts as
 * reachable: the question is whether the network works, not whether the app is healthy.
 */
export function createHttpConnectivityProbe({
  url = "/api/health",
  timeoutMs = 5_000,
  fetchImpl,
}: HttpConnectivityProbeOptions = {}): ConnectivityProbe {
  return async () => {
    const doFetch = fetchImpl ?? globalThis.fetch;
    if (typeof doFetch !== "function") return true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await doFetch(url, {
        method: "HEAD",
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}
