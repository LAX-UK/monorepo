import { ORGANISATION_ACCOUNT, PERSONAL_ACCOUNT } from "@/test/fake-account-directory";
import { describe, expect, it, vi } from "vitest";
import { AccountsCache } from "./accounts-cache";
import { type ApiFetcher, HttpAccountDirectory } from "./http-account-directory";

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const MEMBERSHIPS = { data: [PERSONAL_ACCOUNT, ORGANISATION_ACCOUNT] };

function directory(fetcher: ApiFetcher, sessionKey: string | null = null) {
  const sleep = vi.fn(async () => {});
  const cache = new AccountsCache({ ttlMs: 10_000, maxEntries: 10 });
  return {
    sleep,
    cache,
    directory: new HttpAccountDirectory({ fetcher, cache, sessionKey, sleep }),
  };
}

describe("HttpAccountDirectory.listMine", () => {
  it("returns the accounts on a 200", async () => {
    const { directory: d } = directory(async () => json(200, MEMBERSHIPS));
    await expect(d.listMine()).resolves.toMatchObject({
      ok: true,
      accounts: [{ id: PERSONAL_ACCOUNT.id }, { id: ORGANISATION_ACCOUNT.id }],
    });
  });

  it("retries a 429 once, waiting as Retry-After asks", async () => {
    const fetcher = vi
      .fn<ApiFetcher>()
      .mockResolvedValueOnce(json(429, { error: "Too many requests" }, { "Retry-After": "0.5" }))
      .mockResolvedValueOnce(json(200, MEMBERSHIPS));
    const { directory: d, sleep } = directory(fetcher);
    await expect(d.listMine()).resolves.toMatchObject({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(500);
  });

  it("never waits longer than a second, whatever Retry-After says", async () => {
    const fetcher = vi
      .fn<ApiFetcher>()
      .mockResolvedValueOnce(json(429, {}, { "Retry-After": "30" }))
      .mockResolvedValueOnce(json(200, MEMBERSHIPS));
    const { directory: d, sleep } = directory(fetcher);
    await d.listMine();
    expect(sleep).toHaveBeenCalledWith(1_000);
  });

  it("reports rate_limited after a second 429, never an empty list", async () => {
    const fetcher = vi.fn<ApiFetcher>(async () => json(429, { error: "Too many requests" }));
    const { directory: d } = directory(fetcher);
    await expect(d.listMine()).resolves.toEqual({ ok: false, reason: "rate_limited" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("reports server_error on a 500 without retrying", async () => {
    const fetcher = vi.fn<ApiFetcher>(async () => json(500, { error: "internal" }));
    const { directory: d } = directory(fetcher);
    await expect(d.listMine()).resolves.toEqual({ ok: false, reason: "server_error" });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("reports server_error when the person's own account could not be prepared (503)", async () => {
    const { directory: d } = directory(async () =>
      json(503, { code: "personal_entity_unavailable", data: [] }),
    );
    await expect(d.listMine()).resolves.toEqual({ ok: false, reason: "server_error" });
  });

  it("reports server_error for a 200 with no accounts at all", async () => {
    const { directory: d } = directory(async () => json(200, { data: [] }));
    await expect(d.listMine()).resolves.toEqual({ ok: false, reason: "server_error" });
  });

  it("reports timeout when the API is too slow", async () => {
    const { directory: d } = directory(async () => {
      throw new DOMException("The operation timed out.", "TimeoutError");
    });
    await expect(d.listMine()).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("gives up on a slow API after the timeout", async () => {
    const fetcher: ApiFetcher = (_path, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    const d = new HttpAccountDirectory({
      fetcher,
      cache: new AccountsCache({ ttlMs: 1, maxEntries: 1 }),
      sessionKey: null,
      timeoutMs: 5,
    });
    await expect(d.listMine()).resolves.toEqual({ ok: false, reason: "timeout" });
  });

  it("reports network when the API cannot be reached", async () => {
    const { directory: d } = directory(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(d.listMine()).resolves.toEqual({ ok: false, reason: "network" });
  });

  it("asks the API once per session while the answer is fresh", async () => {
    const fetcher = vi.fn<ApiFetcher>(async () => json(200, MEMBERSHIPS));
    const { directory: d } = directory(fetcher, "session-a");
    await Promise.all([d.listMine(), d.listMine(), d.listMine()]);
    await d.listMine({ mustInclude: ORGANISATION_ACCOUNT.id });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks again when the cached answer lacks the account the browser expects", async () => {
    const fetcher = vi.fn<ApiFetcher>(async () => json(200, MEMBERSHIPS));
    const { directory: d } = directory(fetcher, "session-a");
    await d.listMine();
    await d.listMine({ mustInclude: "33333333-3333-4333-8333-333333333333" });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("never keeps a failure", async () => {
    const fetcher = vi
      .fn<ApiFetcher>()
      .mockResolvedValueOnce(json(500, {}))
      .mockResolvedValueOnce(json(200, MEMBERSHIPS));
    const { directory: d } = directory(fetcher, "session-a");
    await expect(d.listMine()).resolves.toMatchObject({ ok: false });
    await expect(d.listMine()).resolves.toMatchObject({ ok: true });
  });
});

describe("HttpAccountDirectory.findViewedAccount", () => {
  it("returns the account of a live view-as session", async () => {
    const { directory: d } = directory(async () =>
      json(200, {
        data: {
          ...ORGANISATION_ACCOUNT,
          membership: {
            role: "viewer",
            isPrimaryAdmin: false,
            isImpersonation: true,
            impersonationExpiresAt: "2026-10-29T18:00:00.000Z",
          },
        },
      }),
    );
    await expect(d.findViewedAccount(ORGANISATION_ACCOUNT.id)).resolves.toEqual({
      account: expect.objectContaining({
        id: ORGANISATION_ACCOUNT.id,
        role: "viewer",
        isImpersonation: true,
      }),
      expiresAtIso: "2026-10-29T18:00:00.000Z",
    });
  });

  it("returns null for an ordinary membership or a failed lookup", async () => {
    const member = directory(async () =>
      json(200, {
        data: { ...ORGANISATION_ACCOUNT, membership: { role: "admin", isPrimaryAdmin: false } },
      }),
    );
    await expect(member.directory.findViewedAccount(ORGANISATION_ACCOUNT.id)).resolves.toBeNull();
    const failed = directory(async () => json(500, {}));
    await expect(failed.directory.findViewedAccount(ORGANISATION_ACCOUNT.id)).resolves.toBeNull();
  });
});
