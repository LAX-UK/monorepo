/**
 * Recovers live updates when the socket client's file has gone after a deploy.
 *
 * The client is a content-hashed chunk fetched when a live surface first mounts. A page from the
 * previous build (prefetched route code, an open tab) asks for that build's file, which a deploy
 * has removed, so every retry fails the same way and the page would wait on "connecting" forever.
 * Like the phone menu's repeated load failure, the way out is a fresh page: after a few failures
 * in a row, and only while the browser is online, the file is checked once with an uncached
 * `HEAD`. If the server says it is gone (404 or 410), the page reloads onto the current build,
 * at most once per tab every ten minutes so an unhealthy deploy cannot cause a reload loop.
 * Anything else (offline, a network error, the file still there) is a connection problem, and the
 * facade keeps retrying with backoff and as soon as the browser is back online.
 */

/** Failed fetches in a row before the file is checked: about 5 s with the retry backoff. */
export const STALE_CHUNK_FAILURES = 3;
export const STALE_CHUNK_RELOAD_KEY = "lax:live-socket-chunk-reload-at";
export const STALE_CHUNK_RELOAD_GUARD_MS = 10 * 60_000;

type StorageLike = Pick<Storage, "getItem" | "setItem">;

export type StaleChunkRecoveryDeps = {
  fetch: (url: string, init: RequestInit) => Promise<Pick<Response, "status">>;
  storage: () => StorageLike | null;
  reload: () => void;
  isOnline: () => boolean;
  now: () => number;
};

/**
 * The URL of the chunk a webpack `ChunkLoadError` failed to fetch, or `null` for other errors. A
 * wrapper that keeps the original as `cause` is looked through.
 */
export function chunkUrlOf(error: Error): string | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current instanceof Error; depth += 1) {
    const request = (current as Error & { request?: unknown }).request;
    if (typeof request === "string" && request) return request;
    const match = /^Loading chunk \S+ failed\.\s*\((?:error|timeout|missing): (\S+?)\)/.exec(
      current.message,
    );
    if (match?.[1]) return match[1];
    current = current.cause;
  }
  return null;
}

function browserDeps(): StaleChunkRecoveryDeps {
  return {
    fetch: (url, init) => fetch(url, init),
    storage: () => {
      try {
        return window.sessionStorage;
      } catch {
        return null;
      }
    },
    reload: () => window.location.reload(),
    isOnline: () => navigator.onLine !== false,
    now: () => Date.now(),
  };
}

/** Claims this tab's one reload; `false` if a recent one already happened (or cannot be recorded). */
function claimReload(deps: StaleChunkRecoveryDeps): boolean {
  try {
    const storage = deps.storage();
    if (!storage) return false;
    const last = Number(storage.getItem(STALE_CHUNK_RELOAD_KEY));
    if (Number.isFinite(last) && last > 0 && deps.now() - last < STALE_CHUNK_RELOAD_GUARD_MS) {
      return false;
    }
    storage.setItem(STALE_CHUNK_RELOAD_KEY, String(deps.now()));
    return true;
  } catch {
    return false;
  }
}

/** The `onLoadFailure` handler `getSocket()` gives the lazy socket in the browser. */
export function createStaleChunkRecovery(
  deps: StaleChunkRecoveryDeps = browserDeps(),
): (error: Error, failures: number) => void {
  let checking = false;
  let settled = false;

  return (error, failures) => {
    if (settled || checking || failures < STALE_CHUNK_FAILURES || !deps.isOnline()) return;
    const url = chunkUrlOf(error);
    if (!url) return;
    checking = true;
    deps.fetch(url, { method: "HEAD", cache: "no-store" }).then(
      (response) => {
        checking = false;
        if (response.status !== 404 && response.status !== 410) return;
        // Either way there is nothing more to check: reload now, or (reloaded recently) leave it
        // to the "paused" notice's Refresh button rather than loop.
        settled = true;
        if (claimReload(deps)) deps.reload();
      },
      () => {
        checking = false;
      },
    );
  };
}
