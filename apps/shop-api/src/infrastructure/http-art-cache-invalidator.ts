import type {
  ArtCacheInvalidator,
  ArtCatalogueScope,
} from "../application/ports/art-cache-invalidator.js";

/** The tags lax.art caches reads under and lets shop-api purge; it rejects anything else. */
const EDITORIAL_TAG = "art:editorial";
const ARTWORKS_TAG = "art:artworks";
const ARTISTS_TAG = "art:artists";

/** Editorial pages show artworks and artists, so a catalogue change purges them too. */
const CATALOGUE_TAGS: Record<ArtCatalogueScope, readonly string[]> = {
  artworks: [ARTWORKS_TAG, EDITORIAL_TAG],
  artists: [ARTISTS_TAG, ARTWORKS_TAG, EDITORIAL_TAG],
};
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

  async function attempt(tags: readonly string[]): Promise<void> {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [REVALIDATE_SECRET_HEADER]: config.secret,
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`lax.art revalidation responded ${response.status}`);
    }
  }

  async function send(tags: readonly string[]): Promise<void> {
    let lastError: unknown;
    for (let n = 1; n <= MAX_ATTEMPTS; n++) {
      try {
        await attempt(tags);
        return;
      } catch (error) {
        lastError = error;
        if (n < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
    throw lastError;
  }

  return {
    invalidateEditorial: () => send([EDITORIAL_TAG]),
    invalidateCatalogue: (scope) => send(CATALOGUE_TAGS[scope]),
  };
}

export const noopArtCacheInvalidator: ArtCacheInvalidator = {
  invalidateEditorial: async () => {},
  invalidateCatalogue: async () => {},
};
