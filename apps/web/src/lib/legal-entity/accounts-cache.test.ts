import { ORGANISATION_ACCOUNT, PERSONAL_ACCOUNT } from "@/test/fake-account-directory";
import { describe, expect, it, vi } from "vitest";
import type { AccountsLookup } from "./account-directory";
import { AccountsCache } from "./accounts-cache";

const BOTH: AccountsLookup = { ok: true, accounts: [PERSONAL_ACCOUNT, ORGANISATION_ACCOUNT] };

function clock(start = 0) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe("AccountsCache", () => {
  it("keeps an answer for the time to live, then reads again", async () => {
    const time = clock();
    const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 5, now: time.now });
    const load = vi.fn(async () => BOTH);
    await cache.getOrLoad("s", null, load);
    time.advance(9_999);
    await cache.getOrLoad("s", null, load);
    expect(load).toHaveBeenCalledTimes(1);
    time.advance(1);
    await cache.getOrLoad("s", null, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps sessions apart", async () => {
    const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 5 });
    const load = vi.fn(async () => BOTH);
    await cache.getOrLoad("a", null, load);
    await cache.getOrLoad("b", null, load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent reads", async () => {
    const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 5 });
    let release: (value: AccountsLookup) => void = () => {};
    const load = vi.fn(
      () =>
        new Promise<AccountsLookup>((resolve) => {
          release = resolve;
        }),
    );
    const reads = Promise.all([cache.getOrLoad("s", null, load), cache.getOrLoad("s", null, load)]);
    release(BOTH);
    await expect(reads).resolves.toEqual([BOTH, BOTH]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("re-reads when the kept answer lacks the account asked for", async () => {
    const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 5 });
    const load = vi
      .fn<() => Promise<AccountsLookup>>()
      .mockResolvedValueOnce({ ok: true, accounts: [PERSONAL_ACCOUNT] })
      .mockResolvedValueOnce(BOTH);
    await cache.getOrLoad("s", null, load);
    await expect(cache.getOrLoad("s", ORGANISATION_ACCOUNT.id, load)).resolves.toEqual(BOTH);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("never keeps a failure", async () => {
    const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 5 });
    const load = vi
      .fn<() => Promise<AccountsLookup>>()
      .mockResolvedValueOnce({ ok: false, reason: "rate_limited" })
      .mockResolvedValueOnce(BOTH);
    await cache.getOrLoad("s", null, load);
    await expect(cache.getOrLoad("s", null, load)).resolves.toEqual(BOTH);
  });

  it("forgets a session, including a read already under way", async () => {
    const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 5 });
    let release: (value: AccountsLookup) => void = () => {};
    const stale = cache.getOrLoad(
      "s",
      null,
      () =>
        new Promise<AccountsLookup>((resolve) => {
          release = resolve;
        }),
    );
    cache.forget("s");
    release({ ok: true, accounts: [PERSONAL_ACCOUNT] });
    await stale;
    const load = vi.fn(async () => BOTH);
    await expect(cache.getOrLoad("s", null, load)).resolves.toEqual(BOTH);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("drops the oldest session past its size", async () => {
    const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 2 });
    const load = vi.fn(async () => BOTH);
    await cache.getOrLoad("a", null, load);
    await cache.getOrLoad("b", null, load);
    await cache.getOrLoad("c", null, load);
    await cache.getOrLoad("a", null, load);
    expect(load).toHaveBeenCalledTimes(4);
  });
});
