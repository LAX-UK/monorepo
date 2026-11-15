import { CHUNK_LOAD_RECOVERY_SNIPPET } from "@/lib/csp/chunk-load-recovery-snippet.client";
import { INLINE_HEAD_SCRIPTS } from "@/lib/csp/inline-head-scripts";
import {
  STALE_CHUNK_RELOAD_GUARD_MS,
  STALE_CHUNK_RELOAD_KEY,
} from "@/lib/socket-chunk-recovery.client";
import { describe, expect, it, vi } from "vitest";

type Listener = (event: unknown) => void;

function run(
  input: { status?: number; online?: boolean; stored?: string | null; fetchFails?: boolean } = {},
) {
  const listeners: Record<string, Listener> = {};
  const store = new Map<string, string>();
  if (input.stored) store.set(STALE_CHUNK_RELOAD_KEY, input.stored);
  const reload = vi.fn();
  const fetchMock = vi.fn(() =>
    input.fetchFails
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ status: input.status ?? 404 }),
  );
  const win = {
    addEventListener: (name: string, fn: Listener) => {
      listeners[name] = fn;
    },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
    location: { reload },
  };
  new Function("window", "navigator", "fetch", CHUNK_LOAD_RECOVERY_SNIPPET)(
    win,
    { onLine: input.online ?? true },
    fetchMock,
  );
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
  return { listeners, reload, fetchMock, store, settle };
}

const chunk = "/_next/static/chunks/app/lot-1a2b3c.js";
const scriptError = (src = chunk) => ({ target: { tagName: "SCRIPT", src } });

describe("site-wide chunk-load recovery", () => {
  it("is hashed into the CSP with the other inline head scripts", () => {
    expect(INLINE_HEAD_SCRIPTS).toContain(CHUNK_LOAD_RECOVERY_SNIPPET);
  });

  it("reloads once when a build file has gone (404) after a script fails to load", async () => {
    const { listeners, reload, fetchMock, store, settle } = run();
    listeners.error?.(scriptError());
    await settle();
    expect(fetchMock).toHaveBeenCalledWith(chunk, { method: "HEAD", cache: "no-store" });
    expect(reload).toHaveBeenCalledTimes(1);
    expect(store.has(STALE_CHUNK_RELOAD_KEY)).toBe(true);
  });

  it("reloads when a lazy import rejects with a chunk-load error for a missing file", async () => {
    const { listeners, reload, fetchMock, settle } = run({ status: 410 });
    listeners.unhandledrejection?.({
      reason: new Error(`Loading chunk 123 failed.\n(error: https://lax.test${chunk})`),
    });
    await settle();
    expect(fetchMock).toHaveBeenCalledWith(chunk, { method: "HEAD", cache: "no-store" });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("does not reload twice within the guard window", async () => {
    const recent = String(Date.now() - STALE_CHUNK_RELOAD_GUARD_MS / 2);
    const { listeners, reload, settle } = run({ stored: recent });
    listeners.error?.(scriptError());
    await settle();
    expect(reload).not.toHaveBeenCalled();
  });

  it("leaves connection problems alone: still there, offline, or the check itself failing", async () => {
    for (const input of [{ status: 200 }, { online: false }, { fetchFails: true }]) {
      const { listeners, reload, settle } = run(input);
      listeners.error?.(scriptError());
      await settle();
      expect(reload).not.toHaveBeenCalled();
    }
  });

  it("ignores failures that are not build files", async () => {
    const { listeners, fetchMock, settle } = run();
    listeners.error?.(scriptError("https://www.googletagmanager.com/gtm.js"));
    listeners.error?.({ target: { tagName: "IMG", src: chunk } });
    listeners.unhandledrejection?.({ reason: new Error("boom") });
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
