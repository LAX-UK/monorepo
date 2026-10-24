import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { IDEMPOTENCY_PENDING_VALUE } from "../services/interfaces/idempotency-store.js";
import { InMemoryIdempotencyStore } from "../testing/staff-mutation-guards.js";
import { createAdminIdempotency } from "./admin-idempotency.js";

const KEY = "key-0001-aaaa";

function setup(
  options: {
    userId?: string;
    store?: InMemoryIdempotencyStore;
    handler?: (c: import("hono").Context) => Response | Promise<Response>;
  } = {},
) {
  const store = options.store ?? new InMemoryIdempotencyStore();
  const respond =
    options.handler ?? ((c: import("hono").Context) => c.json({ data: { id: "payout-1" } }, 201));
  const handler = vi.fn(respond);
  const app = new Hono<{ Variables: { userId?: string } }>();
  app.use("*", async (c, next) => {
    c.set("userId", options.userId ?? "staff-1");
    await next();
  });
  app.post("/act", createAdminIdempotency(store, "payouts.mark-paid"), (c) => handler(c));
  const post = (body: unknown, headers: Record<string, string> = { "Idempotency-Key": KEY }) =>
    app.request("/act", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  return { app, store, handler, post };
}

describe("createAdminIdempotency", () => {
  it.each([
    ["missing", {}],
    ["too short", { "Idempotency-Key": "short" }],
    ["with spaces", { "Idempotency-Key": "not a valid key at all" }],
  ])("refuses a request whose key is %s, without running it", async (_label, headers) => {
    const { post, handler } = setup();

    const res = await post({ a: 1 }, headers);

    expect(res.status).toBe(400);
    expect(((await res.json()) as { code: string }).code).toBe("idempotency_key_required");
    expect(handler).not.toHaveBeenCalled();
  });

  it("runs the first request and keeps its successful answer", async () => {
    const { post, handler, store } = setup();

    const res = await post({ a: 1 });

    expect(res.status).toBe(201);
    expect(res.headers.get("Idempotent-Replayed")).toBeNull();
    expect(handler).toHaveBeenCalledOnce();
    expect([...store.entries.values()]).toHaveLength(1);
    expect([...store.entries.values()][0]).not.toBe(IDEMPOTENCY_PENDING_VALUE);
  });

  it("replays the first answer for the same request without running it again", async () => {
    const { post, handler } = setup();

    const first = await post({ a: 1 });
    const second = await post({ a: 1 });

    expect(second.status).toBe(201);
    expect(second.headers.get("Idempotent-Replayed")).toBe("true");
    expect(await second.json()).toEqual(await first.json());
    expect(handler).toHaveBeenCalledOnce();
  });

  it("refuses the same key reused for a different request body", async () => {
    const { post, handler } = setup();
    await post({ a: 1 });

    const res = await post({ a: 2 });

    expect(res.status).toBe(422);
    expect(((await res.json()) as { code: string }).code).toBe("idempotency_key_reuse");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("answers 409 while the first request is still in flight", async () => {
    const store = new InMemoryIdempotencyStore();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { post, handler } = setup({
      store,
      handler: async (c) => {
        await gate;
        return c.json({ ok: true });
      },
    });

    const first = post({ a: 1 });
    for (let i = 0; i < 50 && handler.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 2));
    }
    const concurrent = await post({ a: 1 });
    release();
    await first;

    expect(concurrent.status).toBe(409);
    expect(((await concurrent.json()) as { code: string }).code).toBe("idempotency_in_progress");
    expect(handler).toHaveBeenCalledOnce();
  });

  it("does not keep a failed answer, so the same key can be retried", async () => {
    let calls = 0;
    const { post, handler, store } = setup({
      handler: (c) => {
        calls += 1;
        return calls === 1 ? c.json({ error: "conflict" }, 409) : c.json({ ok: true });
      },
    });

    const failed = await post({ a: 1 });
    expect(failed.status).toBe(409);
    expect(store.entries.size).toBe(0);

    const retried = await post({ a: 1 });
    expect(retried.status).toBe(200);
    expect(retried.headers.get("Idempotent-Replayed")).toBeNull();
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("releases the key when the handler throws", async () => {
    const { post, store } = setup({
      handler: () => {
        throw new Error("boom");
      },
    });

    const res = await post({ a: 1 });

    expect(res.status).toBe(500);
    expect(store.entries.size).toBe(0);
  });

  it("scopes the key to the signed-in person", async () => {
    const store = new InMemoryIdempotencyStore();
    const one = setup({ store, userId: "staff-1" });
    const two = setup({ store, userId: "staff-2" });

    await one.post({ a: 1 });
    const res = await two.post({ a: 1 });

    expect(res.headers.get("Idempotent-Replayed")).toBeNull();
    expect(two.handler).toHaveBeenCalledOnce();
  });
});
