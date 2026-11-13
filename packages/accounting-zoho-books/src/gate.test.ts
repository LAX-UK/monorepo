import { describe, expect, it } from "vitest";
import { InMemoryCallBudget } from "./call-budget.js";
import { ZohoRateLimitedError } from "./errors.js";
import { RequestGate } from "./gate.js";
import { FakeClock } from "./testing/index.js";

const options = { ratePerMinute: 100, maxConcurrent: 5, maxQueueWaitMs: 30_000 };

describe("RequestGate", () => {
  it("allows 100 a minute and makes the 101st wait for the window", async () => {
    const clock = new FakeClock();
    const gate = new RequestGate(clock, {
      ...options,
      maxConcurrent: 200,
      maxQueueWaitMs: 120_000,
    });
    for (let i = 0; i < 100; i++) (await gate.acquire("org"))();
    const start = clock.now();
    let granted = false;
    const waiting = gate.acquire("org").then((release) => {
      granted = true;
      release();
    });
    await clock.advance(59_999);
    expect(granted).toBe(false);
    await clock.advance(1);
    await waiting;
    expect(granted).toBe(true);
    expect(clock.now() - start).toBe(60_000);
  });

  it("limits each organisation separately", async () => {
    const clock = new FakeClock();
    const gate = new RequestGate(clock, { ...options, maxConcurrent: 200 });
    for (let i = 0; i < 100; i++) (await gate.acquire("a"))();
    const other = await gate.acquire("b");
    other();
    expect(clock.sleeps).toEqual([]);
  });

  it("runs at most 5 at once and hands a freed slot to the next in line, in order", async () => {
    const clock = new FakeClock();
    const gate = new RequestGate(clock, options);
    const releases = await Promise.all(Array.from({ length: 5 }, () => gate.acquire("org")));
    const order: number[] = [];
    const queued = [6, 7].map((n) =>
      gate.acquire("org").then((release) => {
        order.push(n);
        return release;
      }),
    );
    await clock.advance(0);
    expect(order).toEqual([]);
    releases[0]?.();
    await clock.advance(0);
    expect(order).toEqual([6]);
    releases[1]?.();
    await clock.advance(0);
    expect(order).toEqual([6, 7]);
    for (const r of releases.slice(2)) r();
    for (const r of await Promise.all(queued)) r();
  });

  it("refuses locally when the wait would be longer than allowed, and frees what it held", async () => {
    const clock = new FakeClock();
    const gate = new RequestGate(clock, { ...options, maxConcurrent: 200, maxQueueWaitMs: 1_000 });
    for (let i = 0; i < 100; i++) (await gate.acquire("org"))();
    const refused = gate.acquire("org");
    refused.catch(() => undefined);
    await expect(clock.settle(refused)).rejects.toBeInstanceOf(ZohoRateLimitedError);
    await expect(clock.settle(refused)).rejects.toMatchObject({
      source: "local",
      certainty: "rejected",
    });
  });

  it("a queued call gives up after maxQueueWaitMs and does not keep a slot", async () => {
    const clock = new FakeClock();
    const gate = new RequestGate(clock, { ...options, maxQueueWaitMs: 1_000 });
    const held = await Promise.all(Array.from({ length: 5 }, () => gate.acquire("org")));
    const refused = gate.acquire("org");
    refused.catch(() => undefined);
    await expect(clock.settle(refused)).rejects.toMatchObject({ code: "queue_timeout" });
    for (const release of held) release();
    const next = await gate.acquire("org");
    next();
  });
});

describe("InMemoryCallBudget", () => {
  it("stops at the limit, counts per organisation, and starts again the next UTC day", async () => {
    const clock = new FakeClock(Date.UTC(2026, 10, 12, 23, 59, 0));
    const budget = new InMemoryCallBudget(clock, 2);
    expect((await budget.consume("a")).allowed).toBe(true);
    expect((await budget.consume("a")).allowed).toBe(true);
    expect(await budget.consume("a")).toEqual({ allowed: false, used: 2, limit: 2 });
    expect((await budget.consume("b")).allowed).toBe(true);
    await clock.advance(61_000);
    expect((await budget.consume("a")).allowed).toBe(true);
  });
});
