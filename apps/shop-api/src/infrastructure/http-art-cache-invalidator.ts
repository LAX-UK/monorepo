import type { ArtCacheInvalidator } from "../application/ports/art-cache-invalidator.js";

/** The only tag lax.art caches editorial reads under; its allowlist rejects anything else. */
const EDITORIAL_TAG = "art:editorial";
const ATTEMPT_TIMEOUT_MS = 2_000;
const RETRY_DELAY_MS = 500;
const MAX_ATTEMPTS = 2;

export const REVALIDATE_SECRET_HEADER = "x-revalidate-secret";

export type HttpArtCacheInvalidatorConfig = {
  url: string;
  secret: string;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
};

export function createHttpArtCacheInvalidator(
  config: HttpArtCacheInvalidatorConfig,
): ArtCacheInvalidator {
  const fetchImpl = config.fetchImpl ?? fetch;
  const retryDelayMs = config.retryDelayMs ?? RETRY_DELAY_MS;

  async function attempt(): Promise<void> {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REVALIDATE_SECRET_HEADER]: config.secret,
      },
      body: JSON.stringify({ tags: [EDITORIAL_TAG] }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`lax.art revalidation responded ${response.status}`);
    }
  }

  return {
    async invalidateEditorial() {
      let lastError: unknown;
      for (let n = 1; n <= MAX_ATTEMPTS; n++) {
        try {
          await attempt();
          return;
        } catch (error) {
          lastError = error;
          if (n < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
      throw lastError;
    },
  };
}

export const noopArtCacheInvalidator: ArtCacheInvalidator = {
  invalidateEditorial: async () => {},
};
