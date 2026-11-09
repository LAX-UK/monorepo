import { type JWTVerifyGetKey, createLocalJWKSet, errors } from "jose";

/**
 * How long consumers may cache `/.well-known/jwks.json`. The issuer keeps a rotating key published
 * for longer than this (see its retirement window), and every verifier refreshes on this cadence,
 * so the two stay in step.
 */
export const DISCOVERY_CACHE_TTL_MS = 60 * 1000;

/** The longest a verifier keeps using its last good key set while the issuer cannot be reached. */
export const JWKS_MAX_STALE_MS = 10 * 60 * 1000;

/** After a failed fetch, no new fetch starts until this long has passed. */
export const JWKS_FAILURE_COOLDOWN_MS = 30 * 1000;

/**
 * A set older than the refresh interval but younger than this is served as is while a refresh runs
 * in the background; an older set is refreshed before use, so an idle verifier never trusts a set
 * much older than two refresh intervals without checking.
 */
export const JWKS_STALE_WHILE_REVALIDATE_MS = 2 * DISCOVERY_CACHE_TTL_MS;

/** An unknown `kid` triggers at most one refetch per this interval. */
export const JWKS_MISS_REFETCH_INTERVAL_MS = 30 * 1000;

const FETCH_TIMEOUT_MS = 5_000;

/** The issuer's key set could not be loaded and no usable earlier copy remains. */
export class JwksUnavailableError extends Error {
  constructor(message = "The signing key set is unavailable", options?: ErrorOptions) {
    super(message, options);
    this.name = "JwksUnavailableError";
  }
}

type Clock = () => number;

/** Told when a fetch of the key set fails, so an outage shows up in logs or metrics. */
export type JwksFetchFailureReporter = (failure: { url: string; reason: string }) => void;

const defaultFailureReporter: JwksFetchFailureReporter = (failure) => {
  console.warn("jwks_fetch_failed", failure);
};

/** Resolves the key for a token header; assignable to the resolver `jwtVerify` takes. */
export type ResolveKey = (header: Parameters<JWTVerifyGetKey>[0]) => ReturnType<JWTVerifyGetKey>;

type KeySet = {
  resolve: ResolveKey;
  fetchedAt: number;
};

export type JwksHolder = {
  /** Resolves the verification key for a token header, refreshing or serving a stale set as needed. */
  getKey: ResolveKey;
  /** When the current key set was fetched (ms since epoch), or null before the first success. */
  fetchedAt(): number | null;
  /** Whether this holder has ever seen a key with this id published. */
  hasSeen(kid: string): boolean;
};

/**
 * Holds the issuer's published signing keys for a verifier.
 *
 * - The set is refreshed about every {@link DISCOVERY_CACHE_TTL_MS}. Concurrent callers share one
 *   fetch. A set up to {@link JWKS_STALE_WHILE_REVALIDATE_MS} old is served while the refresh runs
 *   behind the request, so no caller waits on the issuer for a routine refresh.
 * - If a refresh fails, the last good set keeps serving for up to {@link JWKS_MAX_STALE_MS}, so a
 *   brief issuer outage does not log everyone out. The failed fetch is not retried for
 *   {@link JWKS_FAILURE_COOLDOWN_MS}, so an outage does not become a retry storm. A failed fetch
 *   never adds keys. Past the maximum staleness the set is dropped and verification fails closed.
 * - A token naming an unknown `kid` triggers one refetch, at most once per
 *   {@link JWKS_MISS_REFETCH_INTERVAL_MS}, so a freshly rotated key is picked up without letting a
 *   caller inflate fetches with made-up ids.
 *
 * Revocation trade-off: a key the issuer retires or removes can keep verifying until the next
 * successful refresh, normally under a minute and, while the issuer is unreachable, up to
 * {@link JWKS_MAX_STALE_MS}. Resource tokens are short-lived, so this bounds how long a rotated-out
 * key is trusted without making issuer availability a hard dependency of every request.
 */
export function createJwksHolder(options: {
  url: string;
  fetchImpl?: typeof fetch;
  now?: Clock;
  onFetchFailure?: JwksFetchFailureReporter;
}): JwksHolder {
  const now = options.now ?? Date.now;
  const seen = new Set<string>();
  let current: KeySet | null = null;
  let lastAttemptAt = Number.NEGATIVE_INFINITY;
  let lastFailureAt = Number.NEGATIVE_INFINITY;
  let inflight: Promise<void> | null = null;

  const fetchKeys = async (): Promise<KeySet> => {
    const doFetch = options.fetchImpl ?? fetch;
    const response = await doFetch(options.url, {
      headers: { accept: "application/json" },
      // The key set is served from a fixed address; a redirect would send the fetch somewhere
      // nobody configured, so it counts as a failure.
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) throw new JwksUnavailableError(`Key set request failed (${response.status})`);
    const body = (await response.json()) as { keys?: unknown };
    if (!body || !Array.isArray(body.keys)) {
      throw new JwksUnavailableError("The key set response is malformed");
    }
    const jwks = body as Parameters<typeof createLocalJWKSet>[0];
    const local = createLocalJWKSet(jwks);
    const resolve: ResolveKey = (header) => local(header);
    for (const key of jwks.keys) if (typeof key.kid === "string") seen.add(key.kid);
    return { resolve, fetchedAt: now() };
  };

  const refetch = (): Promise<void> => {
    if (inflight) return inflight;
    lastAttemptAt = now();
    inflight = fetchKeys()
      .then((next) => {
        current = next;
      })
      .catch((error: unknown) => {
        lastFailureAt = now();
        try {
          (options.onFetchFailure ?? defaultFailureReporter)({
            url: options.url,
            reason: error instanceof Error ? error.message : "unknown",
          });
        } catch {
          // Reporting must never change what verification does.
        }
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  const usable = (): KeySet | null => {
    if (current && now() - current.fetchedAt > JWKS_MAX_STALE_MS) current = null;
    return current;
  };

  const inFailureCooldown = () => now() - lastFailureAt < JWKS_FAILURE_COOLDOWN_MS;

  const ensureFresh = async (): Promise<KeySet> => {
    const set = usable();
    const age = set ? now() - set.fetchedAt : Number.POSITIVE_INFINITY;
    if (set && age >= DISCOVERY_CACHE_TTL_MS && age < JWKS_STALE_WHILE_REVALIDATE_MS) {
      // Stale while revalidate: answer from the set in hand and refresh behind the request.
      if (inflight || !inFailureCooldown()) void refetch();
      return set;
    }
    if (age >= DISCOVERY_CACHE_TTL_MS && (inflight || !inFailureCooldown())) await refetch();
    const next = usable();
    if (!next) throw new JwksUnavailableError();
    return next;
  };

  const getKey: ResolveKey = async (header) => {
    const set = await ensureFresh();
    try {
      return await set.resolve(header);
    } catch (error) {
      if (!(error instanceof errors.JWKSNoMatchingKey)) throw error;
      const canRefetch =
        inflight ||
        (now() - lastAttemptAt >= JWKS_MISS_REFETCH_INTERVAL_MS && !inFailureCooldown());
      if (!canRefetch) throw error;
      await refetch();
      const after = usable();
      if (!after || after === set) throw error;
      return after.resolve(header);
    }
  };

  return {
    getKey,
    fetchedAt: () => current?.fetchedAt ?? null,
    hasSeen: (kid) => seen.has(kid),
  };
}

const holders = new Map<string, JwksHolder>();

/** The shared holder for an issuer's key set URL: one per URL per process. */
export function jwksHolderFor(url: string): JwksHolder {
  const existing = holders.get(url);
  if (existing) return existing;
  const created = createJwksHolder({ url });
  holders.set(url, created);
  return created;
}

/** The key resolver every verifier passes to `jwtVerify`. */
export function jwksFor(url: string): ResolveKey {
  return jwksHolderFor(url).getKey;
}
