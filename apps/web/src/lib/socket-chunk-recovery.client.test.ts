import { describe, expect, it, vi } from "vitest";
import {
  STALE_CHUNK_RELOAD_GUARD_MS,
  STALE_CHUNK_RELOAD_KEY,
  type StaleChunkRecoveryDeps,
  chunkUrlOf,
  createStaleChunkRecovery,
} from "./socket-chunk-recovery.client";

const CHUNK_URL = "https://test.lax.bid/_next/static/chunks/98870.0123abcd.js";

/** What webpack's runtime rejects `import()` with when a chunk's script fails to load. */
function chunkLoadError(url = CHUNK_URL): Error {
  const error = new Error(`Loading chunk 98870 failed.\n(error: ${url})`);
  error.name = "ChunkLoadError";
  Object.assign(error, { type: "error", request: url });
  return error;
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    data,
  };
}

function setup(overrides: Partial<StaleChunkRecoveryDeps> & { status?: number } = {}) {
  const storage = memoryStorage();
  const deps = {
    fetch: vi.fn(async () => ({ status: overrides.status ?? 404 })),
    storage: () => storage,
    reload: vi.fn(),
    isOnline: () => true,
    now: () => 1_000_000,
    ...overrides,
  };
  return { deps, storage, recover: createStaleChunkRecovery(deps) };
}

const settle = () => new Promise<void>((r) => setTimeout(r, 0));

describe("chunkUrlOf", () => {
  it("reads the chunk URL from a webpack ChunkLoadError", () => {
    expect(chunkUrlOf(chunkLoadError())).toBe(CHUNK_URL);
  });

  it("falls back to the URL in the message", () => {
    expect(chunkUrlOf(new Error(`Loading chunk 98870 failed.\n(timeout: ${CHUNK_URL})`))).toBe(
      CHUNK_URL,
    );
  });

  it("looks through a wrapper that keeps the chunk error as its cause", () => {
    expect(chunkUrlOf(new Error("import failed", { cause: chunkLoadError() }))).toBe(CHUNK_URL);
  });

  it("returns null for other errors", () => {
    expect(chunkUrlOf(new Error("offline"))).toBeNull();
  });
});

describe("createStaleChunkRecovery", () => {
  it("reloads once the chunk has failed three times in a row and the server says it is gone", async () => {
    const { deps, storage, recover } = setup();
    recover(chunkLoadError(), 1);
    recover(chunkLoadError(), 2);
    await settle();
    expect(deps.fetch).not.toHaveBeenCalled();

    recover(chunkLoadError(), 3);
    await settle();
    expect(deps.fetch).toHaveBeenCalledWith(CHUNK_URL, { method: "HEAD", cache: "no-store" });
    expect(deps.reload).toHaveBeenCalledTimes(1);
    expect(storage.data.get(STALE_CHUNK_RELOAD_KEY)).toBe("1000000");

    recover(chunkLoadError(), 4);
    await settle();
    expect(deps.fetch).toHaveBeenCalledTimes(1);
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it("treats 410 like 404", async () => {
    const { deps, recover } = setup({ status: 410 });
    recover(chunkLoadError(), 3);
    await settle();
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload again within ten minutes of the last reload, so it cannot loop", async () => {
    const storage = memoryStorage({ [STALE_CHUNK_RELOAD_KEY]: String(1_000_000 - 60_000) });
    const { deps, recover } = setup({ storage: () => storage });
    recover(chunkLoadError(), 3);
    await settle();
    expect(deps.reload).not.toHaveBeenCalled();
    // Settled: no more checks for this page.
    recover(chunkLoadError(), 4);
    await settle();
    expect(deps.fetch).toHaveBeenCalledTimes(1);
  });

  it("reloads again once the guard has expired", async () => {
    const storage = memoryStorage({
      [STALE_CHUNK_RELOAD_KEY]: String(1_000_000 - STALE_CHUNK_RELOAD_GUARD_MS),
    });
    const { deps, recover } = setup({ storage: () => storage });
    recover(chunkLoadError(), 3);
    await settle();
    expect(deps.reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload when the reload cannot be recorded", async () => {
    const { deps, recover } = setup({ storage: () => null });
    recover(chunkLoadError(), 3);
    await settle();
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it("keeps retrying, without reloading, when the chunk is still there (a passing glitch)", async () => {
    const { deps, recover } = setup({ status: 200 });
    recover(chunkLoadError(), 3);
    await settle();
    recover(chunkLoadError(), 4);
    await settle();
    expect(deps.fetch).toHaveBeenCalledTimes(2);
    expect(deps.reload).not.toHaveBeenCalled();
  });

  it("does not check or reload while offline or when the check itself fails", async () => {
    let online = false;
    const failing = setup({
      isOnline: () => online,
      fetch: vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    });
    failing.recover(chunkLoadError(), 3);
    await settle();
    expect(failing.deps.fetch).not.toHaveBeenCalled();
    online = true;
    failing.recover(chunkLoadError(), 4);
    await settle();
    expect(failing.deps.fetch).toHaveBeenCalledTimes(1);
    expect(failing.deps.reload).not.toHaveBeenCalled();
  });

  it("ignores failures that are not a chunk fetch", async () => {
    const { deps, recover } = setup();
    recover(new Error("boom"), 5);
    await settle();
    expect(deps.fetch).not.toHaveBeenCalled();
  });
});
