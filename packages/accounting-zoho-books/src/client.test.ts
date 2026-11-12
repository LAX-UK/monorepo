import { describe, expect, it } from "vitest";
import { ZohoBudgetExhaustedError } from "./errors.js";
import { toIssueFailure, toLookupFailure } from "./outcome.js";
import {
  FixedBudget,
  TEST_CLIENT_SECRET,
  TEST_ORG,
  TEST_REFRESH_TOKEN,
  createClientHarness,
  isApiRequest,
  tokenReply,
  zohoErrorReply,
  zohoOkReply,
} from "./testing/index.js";

const api = isApiRequest;

describe("requests", () => {
  it("builds the URL from the base, the path and the organisation, and returns the parsed body", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue(zohoOkReply({ invoice: { invoice_id: "1" } }), api);
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices/1", { page: 2 }));
    expect(result).toEqual({
      ok: true,
      value: { status: 200, body: { code: 0, message: "success", invoice: { invoice_id: "1" } } },
    });
    expect(h.transport.requests.find(api)?.url).toBe(
      `https://books.zoho.eu/api/v3/invoices/1?page=2&organization_id=${TEST_ORG}`,
    );
  });

  it("sends JSON for writes", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue(zohoOkReply(), api);
    await h.clock.settle(
      h.client.post(TEST_ORG, "/invoices", { reference_number: "LAX-SHOP-INV-1" }),
    );
    const sent = h.transport.requests.find(api);
    expect(sent?.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(sent?.body ?? "")).toEqual({ reference_number: "LAX-SHOP-INV-1" });
  });

  it.each([
    ["path traversal", "/invoices/../../oauth"],
    ["a query smuggled in the path", "/invoices?x=1"],
    ["a different host", "//evil.example/x"],
    ["no leading slash", "invoices"],
    ["encoded characters", "/invoices/%2e%2e"],
  ])("refuses %s before sending anything", async (_name, path) => {
    const h = createClientHarness();
    await h.connect();
    const result = await h.clock.settle(h.client.get(TEST_ORG, path));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("validation");
    expect(h.transport.requests.filter(api)).toHaveLength(0);
  });

  it("refuses a caller-supplied organization_id and a malformed organisation", async () => {
    const h = createClientHarness();
    await h.connect();
    const a = await h.clock.settle(h.client.get(TEST_ORG, "/invoices", { organization_id: "999" }));
    const b = await h.clock.settle(h.client.get("1&x=2", "/invoices"));
    expect(a.ok || b.ok).toBe(false);
    expect(h.transport.requests.filter(api)).toHaveLength(0);
  });
});

describe("retries", () => {
  it("retries a GET on 503 with jittered exponential backoff, then succeeds", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport
      .enqueue({ status: 503, body: {} }, api)
      .enqueue({ status: 502, body: {} }, api)
      .enqueue(zohoOkReply(), api);
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(true);
    expect(h.transport.requests.filter(api)).toHaveLength(3);
    // random() is 0.5: equal jitter gives 0.75 of the exponential ceiling (500, 1000).
    expect(h.clock.sleeps.filter((ms) => ms !== h.config.requestTimeoutMs)).toEqual([375, 750]);
    expect(h.metrics.total("zoho_books_retries_total")).toBe(2);
  });

  it("retries a GET after a connection failure and a timeout", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport
      .enqueue({ fail: new Error("ECONNRESET") }, api)
      .enqueue({ hang: true }, api)
      .enqueue(zohoOkReply(), api);
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(true);
    expect(h.transport.requests.filter(api)).toHaveLength(3);
  });

  it("gives up after maxAttempts and returns the last error", async () => {
    const h = createClientHarness();
    await h.connect();
    for (let i = 0; i < 3; i++) h.transport.enqueue({ status: 500, body: {} }, api);
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("server");
    expect(h.transport.requests.filter(api)).toHaveLength(3);
  });

  it("never retries a write after 5xx, a timeout or a dropped connection: it may have happened", async () => {
    for (const reply of [
      { status: 500, body: {} },
      { status: 504, body: {} },
      { hang: true as const },
      { fail: new Error("ECONNRESET") },
    ]) {
      const h = createClientHarness();
      await h.connect();
      h.transport.enqueue(reply, api);
      const result = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.certainty).toBe("unknown");
      expect(h.transport.requests.filter(api)).toHaveLength(1);
    }
  });

  it("retries a write on 429, because Zoho did not act on it, waiting at least Retry-After", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport
      .enqueue({ status: 429, body: {}, headers: { "retry-after": "5" } }, api)
      .enqueue(zohoOkReply(), api);
    const result = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    expect(result.ok).toBe(true);
    expect(h.clock.sleeps).toContain(5_000);
  });

  it("returns a 429 whose Retry-After is longer than we will wait", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue({ status: 429, body: {}, headers: { "retry-after": "3600" } }, api);
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("rate_limited");
      expect(result.error.retryAfterMs).toBe(3_600_000);
    }
    expect(h.transport.requests.filter(api)).toHaveLength(1);
  });

  it("does not retry validation, not found or conflict", async () => {
    for (const status of [400, 404, 409]) {
      const h = createClientHarness();
      await h.connect();
      h.transport.enqueue(zohoErrorReply(status, 1002), api);
      await h.clock.settle(h.client.get(TEST_ORG, "/invoices/1"));
      expect(h.transport.requests.filter(api)).toHaveLength(1);
    }
  });
});

describe("timeouts", () => {
  it("ends a request that never answers after requestTimeoutMs and aborts it", async () => {
    const h = createClientHarness({ config: { requestTimeoutMs: 2_000 } });
    await h.connect();
    h.transport.enqueue({ hang: true }, api);
    const start = h.clock.now();
    const result = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    expect(h.clock.now() - start).toBe(2_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("network");
      expect(result.error.code).toBe("timeout");
      expect(result.error.certainty).toBe("unknown");
    }
    expect(h.clock.pendingTimers).toBe(0);
  });
});

describe("limits", () => {
  it("never has more than 5 requests in flight for one organisation", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue(zohoOkReply(), api);
    await h.clock.settle(h.client.get(TEST_ORG, "/invoices")); // warm the token so only API calls are held
    let open!: () => void;
    h.transport.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    for (let i = 0; i < 12; i++) h.transport.enqueue(zohoOkReply(), api);
    const calls = Promise.all(
      Array.from({ length: 12 }, () => h.client.get(TEST_ORG, "/invoices")),
    );
    await h.clock.advance(0);
    expect(h.transport.maxInFlight).toBe(5);
    open();
    const results = await h.clock.settle(calls);
    expect(results.every((r) => r.ok)).toBe(true);
    expect(h.transport.maxInFlight).toBe(5);
  });

  it("paces 100 calls a minute per organisation", async () => {
    const h = createClientHarness({ config: { maxQueueWaitMs: 300_000, dailyCallBudget: 1_000 } });
    await h.connect();
    for (let i = 0; i < 101; i++) h.transport.enqueue(zohoOkReply(), api);
    const start = h.clock.now();
    const results = await h.clock.settle(
      Promise.all(Array.from({ length: 101 }, () => h.client.get(TEST_ORG, "/invoices"))),
    );
    expect(results.every((r) => r.ok)).toBe(true);
    expect(h.clock.now() - start).toBeGreaterThanOrEqual(60_000);
  });

  it("stops hard when the daily budget is spent: nothing more is sent, a metric is raised", async () => {
    const h = createClientHarness({ config: { dailyCallBudget: 2 } });
    await h.connect();
    h.transport.enqueue(zohoOkReply(), api).enqueue(zohoOkReply(), api).enqueue(zohoOkReply(), api);
    const r1 = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    const r2 = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    const r3 = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    expect([r1.ok, r2.ok, r3.ok]).toEqual([true, true, false]);
    if (!r3.ok) {
      expect(r3.error).toBeInstanceOf(ZohoBudgetExhaustedError);
      expect(r3.error.certainty).toBe("rejected");
    }
    expect(h.transport.requests.filter(api)).toHaveLength(2);
    expect(h.metrics.total("zoho_books_daily_budget_exhausted_total")).toBe(1);
    expect(h.metrics.gauges.at(-1)).toMatchObject({
      name: "zoho_books_daily_calls_used",
      value: 2,
    });
  });

  it("counts every attempt, retries included, against the budget", async () => {
    const budget = new FixedBudget(10);
    const h = createClientHarness({ budget });
    await h.connect();
    h.transport.enqueue({ status: 503, body: {} }, api).enqueue(zohoOkReply(), api);
    await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(budget.used).toBe(2);
  });

  it("fails closed when the budget cannot be read", async () => {
    const budget = new FixedBudget(10);
    budget.failing = true;
    const h = createClientHarness({ budget });
    await h.connect();
    const result = await h.clock.settle(h.client.get(TEST_ORG, "/invoices"));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("budget_unavailable");
    expect(h.transport.requests.filter(api)).toHaveLength(0);
  });
});

describe("logging", () => {
  it("never logs a token, the client secret, a body field with personal data or an email", async () => {
    const h = createClientHarness();
    await h.connect(TEST_ORG, "access-token-SENSITIVE");
    h.transport.enqueue(
      {
        status: 400,
        body: {
          code: 1002,
          message: "Contact ada@example.com (Ada Lovelace) already exists",
          contact_name: "Ada Lovelace",
          email: "ada@example.com",
        },
      },
      api,
    );
    await h.clock.settle(
      h.client.post(
        TEST_ORG,
        "/contacts",
        {
          contact_name: "Ada Lovelace",
          email: "ada@example.com",
          phone: "07700900123",
          billing_address: { address: "1 Analytical Way" },
          reference_number: "LAX-SHOP-CON-1",
        },
        { search_text: "ada@example.com" },
      ),
    );
    const log = h.logger.dump();
    for (const secret of [
      "access-token-SENSITIVE",
      TEST_CLIENT_SECRET,
      TEST_REFRESH_TOKEN,
      "Ada",
      "ada@example.com",
      "07700900123",
      "Analytical",
      "Zoho-oauthtoken",
      "already exists",
    ]) {
      expect(log).not.toContain(secret);
    }
    expect(log).toContain("LAX-SHOP-CON-1");
    expect(log).toContain("zoho_books.call");
    expect(h.logger.entries.some((e) => e.event === "zoho_books.request")).toBe(true);
  });

  it("logs the outcome of each call with its certainty", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue({ status: 500, body: {} }, api);
    await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    const call = h.logger.entries.find((e) => e.event === "zoho_books.call");
    expect(call?.fields).toMatchObject({
      outcome: "server",
      certainty: "unknown",
      sent: true,
      status: 500,
    });
  });

  it("keeps Zoho's own error text out of the error itself", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue(zohoErrorReply(400, 1002, "Ada Lovelace is not valid"), api);
    const result = await h.clock.settle(h.client.post(TEST_ORG, "/contacts", { total: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        JSON.stringify([result.error.message, result.error.reason, result.error.code]),
      ).not.toContain("Ada");
      expect(result.error.zohoCode).toBe(1002);
    }
  });
});

describe("domain mapping", () => {
  it("tells the domain rejected apart from unknown", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport.enqueue(zohoErrorReply(400, 1002), api).enqueue({ status: 500, body: {} }, api);
    const rejected = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    const unknown = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    if (rejected.ok || unknown.ok) throw new Error("expected failures");
    expect(toIssueFailure(rejected.error)).toEqual({
      status: "rejected",
      reason: "zoho_books_validation_invalid_request",
    });
    expect(toIssueFailure(unknown.error)).toEqual({
      status: "unknown",
      detail: "zoho_books_server_http_500",
    });
  });

  it("reads absence only from a 404; any other lookup failure is unavailable", async () => {
    const h = createClientHarness();
    await h.connect();
    h.transport
      .enqueue(zohoErrorReply(404, 1002), api)
      .enqueue(zohoErrorReply(401, 57), api)
      .enqueue(tokenReply("t2"), (r) => !api(r))
      .enqueue(zohoErrorReply(401, 57), api);
    const missing = await h.clock.settle(h.client.get(TEST_ORG, "/invoices/1"));
    const denied = await h.clock.settle(h.client.get(TEST_ORG, "/invoices/1"));
    if (missing.ok || denied.ok) throw new Error("expected failures");
    expect(toLookupFailure(missing.error)).toEqual({ status: "not_found" });
    expect(toLookupFailure(denied.error).status).toBe("unavailable");
  });
});

describe("an unscripted request fails loudly (no live calls in tests)", () => {
  it("is reported as unknown rather than reaching anywhere", async () => {
    const h = createClientHarness();
    await h.connect();
    const result = await h.clock.settle(h.client.post(TEST_ORG, "/invoices", { total: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.certainty).toBe("unknown");
  });
});
