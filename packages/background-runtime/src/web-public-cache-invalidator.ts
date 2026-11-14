/**
 * Asks the web app to drop cached public sale and lot reads (`POST /api/revalidate` on lax.bid).
 * The tags come from `publicPageTagsFor*` in `@auction/domain`. A failure never fails the change
 * that caused it: the cached reads still expire on their own revalidate window.
 */
export interface WebPublicCacheInvalidator {
  invalidate(tags: readonly string[]): Promise<void>;
}

export const WEB_REVALIDATE_SECRET_HEADER = "x-revalidate-secret";

const ATTEMPT_TIMEOUT_MS = 2_000;
const RETRY_DELAY_MS = 300;
const MAX_ATTEMPTS = 2;
/** The web route takes at most 50 tags per request. */
const MAX_TAGS_PER_REQUEST = 50;

export type HttpWebPublicCacheInvalidatorConfig = {
  url: string;
  secret: string;
  fetchImpl?: typeof fetch;
  retryDelayMs?: number;
};

export function createHttpWebPublicCacheInvalidator(
  config: HttpWebPublicCacheInvalidatorConfig,
): WebPublicCacheInvalidator {
  const fetchImpl = config.fetchImpl ?? fetch;
  const retryDelayMs = config.retryDelayMs ?? RETRY_DELAY_MS;

  async function attempt(tags: readonly string[]): Promise<void> {
    const response = await fetchImpl(config.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [WEB_REVALIDATE_SECRET_HEADER]: config.secret,
      },
      body: JSON.stringify({ tags }),
      signal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`web revalidation responded ${response.status}`);
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
    async invalidate(tags) {
      const unique = [...new Set(tags)];
      for (let i = 0; i < unique.length; i += MAX_TAGS_PER_REQUEST) {
        await send(unique.slice(i, i + MAX_TAGS_PER_REQUEST));
      }
    },
  };
}

export const noopWebPublicCacheInvalidator: WebPublicCacheInvalidator = {
  invalidate: async () => {},
};

/** The configured invalidator, or the no-op one while either setting is missing (local, tests). */
export function webPublicCacheInvalidatorFromEnv(env: {
  WEB_REVALIDATE_URL?: string | undefined;
  WEB_REVALIDATE_SECRET?: string | undefined;
}): WebPublicCacheInvalidator {
  const url = env.WEB_REVALIDATE_URL?.trim();
  const secret = env.WEB_REVALIDATE_SECRET?.trim();
  return url && secret
    ? createHttpWebPublicCacheInvalidator({ url, secret })
    : noopWebPublicCacheInvalidator;
}
