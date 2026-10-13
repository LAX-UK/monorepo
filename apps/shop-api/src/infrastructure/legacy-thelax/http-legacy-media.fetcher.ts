import type { LegacyMediaFetcher } from "../../application/ports/legacy-thelax-import.ports.js";

const ALLOWED_HOSTS = new Set(["www.thelax.art", "thelax.art"]);
const USER_AGENT = "LAX-SEO-Migration/1.0 (+https://www.thelax.art)";
const TIMEOUT_MS = 30_000;
const MAX_BYTES = 10 * 1024 * 1024;
const RETRIES = 3;

/** Fetches legacy images over HTTPS from the old site's own hosts only. */
export function createHttpLegacyMediaFetcher(
  options: { fetchImpl?: typeof fetch } = {},
): LegacyMediaFetcher {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async fetch(rawUrl) {
      const url = new URL(rawUrl);
      if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) return null;
      for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
        try {
          const response = await fetchImpl(url, {
            headers: { "user-agent": USER_AGENT },
            redirect: "error",
            signal: AbortSignal.timeout(TIMEOUT_MS),
          });
          if (response.status === 404 || response.status === 410) return null;
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const declared = Number(response.headers.get("content-length") ?? 0);
          if (declared > MAX_BYTES) return null;
          const bytes = Buffer.from(await response.arrayBuffer());
          return bytes.byteLength > MAX_BYTES ? null : bytes;
        } catch (error) {
          if (attempt === RETRIES) throw error;
          await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
        }
      }
      return null;
    },
  };
}
