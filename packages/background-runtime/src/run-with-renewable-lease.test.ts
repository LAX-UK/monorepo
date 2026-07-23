import { describe, expect, it, vi } from "vitest";
import { runWithRenewableLease } from "./run-with-renewable-lease.js";

describe("runWithRenewableLease", () => {
  it("returns skipped_locked when lease is not acquired", async () => {
    const redis = {
      set: vi.fn().mockResolvedValue(null),
    };
    const out = await runWithRenewableLease(redis as never, "k", 1000, async () => "x");
    expect(out).toEqual({ ok: false, reason: "skipped_locked" });
  });

  it("runs fn and releases lease on success", async () => {
    const store = new Map<string, string>();
    const redis = {
      set: vi.fn(async (key: string, val: string, ...args: string[]) => {
        if (args.includes("NX")) {
          if (store.has(key)) return null;
          store.set(key, val);
          return "OK";
        }
        store.set(key, val);
        return "OK";
      }),
      eval: vi.fn(async () => {
        store.delete("k");
        return 1;
      }),
    };
    const fn = vi.fn(async () => 99);
    const out = await runWithRenewableLease(redis as never, "k", 5000, fn, {
      renewIntervalMs: 60_000,
    });
    expect(out).toEqual({ ok: true, value: 99 });
    expect(fn).toHaveBeenCalledOnce();
    expect(store.has("k")).toBe(false);
  });
});
