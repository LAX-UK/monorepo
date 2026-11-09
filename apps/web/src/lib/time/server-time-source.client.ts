/**
 * Where the server's time comes from. The sync depends on this port, so it can be tested with no
 * network and the Bid API adapter can change without touching it.
 */
export interface ServerTimeSource {
  /** The server's clock in milliseconds since the epoch, as it read when it answered. */
  readServerNowMs(signal?: AbortSignal): Promise<number>;
}

/** The Bid API's public `GET /time`, reached through the web app's proxy. */
export function createBidApiTimeSource(
  fetchImpl: typeof fetch = (...args) => fetch(...args),
  url = "/api/bff/time",
): ServerTimeSource {
  return {
    async readServerNowMs(signal) {
      const response = await fetchImpl(url, {
        cache: "no-store",
        credentials: "omit",
        headers: { accept: "application/json" },
        ...(signal ? { signal } : {}),
      });
      if (!response.ok) throw new Error(`Server time request failed (${response.status})`);
      const body = (await response.json()) as { serverNowMs?: unknown };
      if (typeof body.serverNowMs !== "number" || !Number.isFinite(body.serverNowMs)) {
        throw new Error("Server time response is malformed");
      }
      return body.serverNowMs;
    },
  };
}
