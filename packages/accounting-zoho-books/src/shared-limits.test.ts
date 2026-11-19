import { describe, expect, it } from "vitest";
import { ZohoBooksClient, type ZohoBooksClientDeps } from "./client.js";
import { inProcessZohoBooksLimits } from "./limits.js";
import type { CallBudget, RateWindow, RefreshLock } from "./ports.js";
import {
  FakeClock,
  FakeZohoTransport,
  FixedBudget,
  InMemoryTokenStore,
  SharedRateWindow,
  SharedRefreshLock,
  TEST_ORG,
  TEST_REFRESH_TOKEN,
  isApiRequest,
  isTokenRequest,
  testConfig,
  tokenReply,
  zohoOkReply,
} from "./testing/index.js";

/** Two clients that stand for two worker processes: one token store, one transport, one clock. */
function twoProcesses(
  shared: { budget?: CallBudget; rateWindow?: RateWindow; refreshLock?: RefreshLock },
  ratePerMinute = 100,
  clock = new FakeClock(),
) {
  const config = testConfig({ ratePerMinute, maxQueueWaitMs: 0 });
  const transport = new FakeZohoTransport();
  const store = new InMemoryTokenStore();
  const make = () =>
    new ZohoBooksClient({
      config,
      transport,
      tokenStore: store,
      clock,
      random: () => 0.5,
      ...inProcessZohoBooksLimits(shared),
    });
  return { a: make(), b: make(), transport, clock, store };
}

async function connected(p: ReturnType<typeof twoProcesses>) {
  await p.a.registerRefreshToken(TEST_ORG, TEST_REFRESH_TOKEN);
  p.transport.enqueue(tokenReply("access-1"), isTokenRequest);
  p.transport.enqueue(zohoOkReply(), isApiRequest);
  await p.clock.settle(p.a.get(TEST_ORG, "/organizations"));
  p.transport.requests.length = 0;
}

describe("limits shared across processes", () => {
  it("refuses to build a client without the shared limits unless it opts into in-process ones", () => {
    const base = { config: testConfig(), transport: new FakeZohoTransport() };
    const tokenStore = new InMemoryTokenStore();
    const partial = {
      budget: new FixedBudget(10),
      rateWindow: new SharedRateWindow(new FakeClock()),
    };
    const build = (deps: object) => () =>
      new ZohoBooksClient({ ...base, tokenStore, ...deps } as ZohoBooksClientDeps);
    expect(build({})).toThrow("zoho_books_shared_limits_required");
    expect(build(partial)).toThrow("zoho_books_shared_limits_required");
    expect(build({ ...partial, inProcessLimits: Symbol("forged") })).toThrow(
      "zoho_books_shared_limits_required",
    );
    expect(build(inProcessZohoBooksLimits())).not.toThrow();
    expect(build({ ...partial, refreshLock: new SharedRefreshLock() })).not.toThrow();
  });

  it("without a shared window each process has its own: two processes send twice the limit", async () => {
    const p = twoProcesses({}, 3);
    await connected(p);
    for (let i = 0; i < 6; i++) p.transport.enqueue(zohoOkReply(), isApiRequest);
    await p.clock.settle(
      Promise.all([0, 1, 2].flatMap(() => [p.a.get(TEST_ORG, "/x"), p.b.get(TEST_ORG, "/x")])),
    );
    // `a` used one slot connecting, so it sends 2; `b` sends 3: 5 in the minute against a limit of 3.
    expect(p.transport.requests.filter(isApiRequest)).toHaveLength(5);
  });

  it("with a shared window two processes together stay within the limit", async () => {
    const clock = new FakeClock();
    const rateWindow = new SharedRateWindow(clock);
    const q = twoProcesses({ rateWindow }, 3, clock);
    await connected(q);
    for (let i = 0; i < 6; i++) q.transport.enqueue(zohoOkReply(), isApiRequest);
    const results = await q.clock.settle(
      Promise.all([0, 1, 2].flatMap(() => [q.a.get(TEST_ORG, "/x"), q.b.get(TEST_ORG, "/x")])),
    );
    expect(q.transport.requests.filter(isApiRequest)).toHaveLength(2);
    const refused = results.filter((r) => !r.ok);
    expect(refused).toHaveLength(4);
    for (const r of refused) if (!r.ok) expect(r.error.kind).toBe("rate_limited");
  });

  it("waits for a slot in the shared window when the wait fits", async () => {
    const clock = new FakeClock();
    const rateWindow = new SharedRateWindow(clock);
    const config = testConfig({ ratePerMinute: 1, maxQueueWaitMs: 120_000 });
    const transport = new FakeZohoTransport();
    const store = new InMemoryTokenStore();
    const make = () =>
      new ZohoBooksClient({
        config,
        transport,
        tokenStore: store,
        clock,
        ...inProcessZohoBooksLimits({ rateWindow }),
      });
    const a = make();
    const b = make();
    await a.registerRefreshToken(TEST_ORG, TEST_REFRESH_TOKEN);
    transport.enqueue(tokenReply("access-1"), isTokenRequest);
    transport.enqueue(zohoOkReply(), isApiRequest).enqueue(zohoOkReply(), isApiRequest);
    const started = clock.now();
    const [first, second] = await clock.settle(
      Promise.all([a.get(TEST_ORG, "/x"), b.get(TEST_ORG, "/x")]),
    );
    expect(first.ok && second.ok).toBe(true);
    expect(clock.now() - started).toBeGreaterThanOrEqual(60_000);
  });

  it("fails closed when the shared window cannot be read: nothing is sent", async () => {
    const clock = new FakeClock();
    const rateWindow = new SharedRateWindow(clock);
    const q = twoProcesses({ rateWindow }, 100, clock);
    await connected(q);
    rateWindow.fail = true;
    const result = await q.clock.settle(q.b.get(TEST_ORG, "/x"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate_limited");
      expect(result.error.code).toBe("rate_window_unavailable");
    }
    expect(q.transport.requests).toHaveLength(0);
  });

  it("one budget shared by both processes stops both at its limit", async () => {
    const budget = new FixedBudget(3);
    const p = twoProcesses({ budget });
    await connected(p);
    for (let i = 0; i < 4; i++) p.transport.enqueue(zohoOkReply(), isApiRequest);
    const results = await p.clock.settle(
      Promise.all([p.a.get(TEST_ORG, "/x"), p.b.get(TEST_ORG, "/x"), p.b.get(TEST_ORG, "/x")]),
    );
    expect(p.transport.requests.filter(isApiRequest)).toHaveLength(2);
    expect(results.filter((r) => !r.ok && r.error.kind === "budget_exhausted")).toHaveLength(1);
  });

  it("without a shared lock two processes each refresh, and one of them fails", async () => {
    const p = twoProcesses({});
    await p.a.registerRefreshToken(TEST_ORG, TEST_REFRESH_TOKEN);
    p.transport.enqueue(tokenReply("access-a"), isTokenRequest);
    p.transport.enqueue(tokenReply("access-b"), isTokenRequest);
    p.transport.enqueue(zohoOkReply(), isApiRequest).enqueue(zohoOkReply(), isApiRequest);
    const results = await p.clock.settle(
      Promise.all([p.a.get(TEST_ORG, "/x"), p.b.get(TEST_ORG, "/x")]),
    );
    expect(p.transport.requests.filter(isTokenRequest)).toHaveLength(2);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it("with a shared lock one refresh is made and the other process uses its token", async () => {
    const refreshLock = new SharedRefreshLock();
    const p = twoProcesses({ refreshLock });
    await p.a.registerRefreshToken(TEST_ORG, TEST_REFRESH_TOKEN);
    p.transport.enqueue(tokenReply("access-1"), isTokenRequest);
    p.transport.enqueue(zohoOkReply(), isApiRequest).enqueue(zohoOkReply(), isApiRequest);
    const results = await p.clock.settle(
      Promise.all([p.a.get(TEST_ORG, "/x"), p.b.get(TEST_ORG, "/x")]),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(p.transport.requests.filter(isTokenRequest)).toHaveLength(1);
    expect(p.store.saves).toBe(1);
    expect(refreshLock.taken).toBe(2);
    for (const r of p.transport.requests.filter(isApiRequest)) {
      expect(r.headers.authorization).toBe("Zoho-oauthtoken access-1");
    }
  });

  it("fails closed when the refresh lock cannot be taken: no refresh, no request", async () => {
    const refreshLock = new SharedRefreshLock();
    refreshLock.fail = true;
    const p = twoProcesses({ refreshLock });
    await p.a.registerRefreshToken(TEST_ORG, TEST_REFRESH_TOKEN);
    const result = await p.clock.settle(p.a.get(TEST_ORG, "/x"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("auth");
      expect(result.error.code).toBe("refresh_lock_unavailable");
    }
    expect(p.transport.requests).toHaveLength(0);
  });

  it("a cached token is used without taking the lock", async () => {
    const refreshLock = new SharedRefreshLock();
    const p = twoProcesses({ refreshLock });
    await connected(p);
    refreshLock.fail = true;
    p.transport.enqueue(zohoOkReply(), isApiRequest);
    const result = await p.clock.settle(p.a.get(TEST_ORG, "/x"));
    expect(result.ok).toBe(true);
  });
});
