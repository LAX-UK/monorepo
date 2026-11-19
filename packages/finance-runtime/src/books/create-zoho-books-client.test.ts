import {
  FakeZohoTransport,
  InMemoryTokenStore,
  TEST_REFRESH_TOKEN,
  testConfig,
} from "@auction/accounting-zoho-books/testing";
import type { Redis } from "ioredis";
import { describe, expect, it, vi } from "vitest";
import { createZohoBooksHttpClient } from "./create-zoho-books-client.js";

const ORG = "20001";

describe("createZohoBooksHttpClient", () => {
  it("takes the rate slot and the budget in Redis before anything is sent", async () => {
    // The rate window has room; the day's budget is used up.
    const evalScript = vi.fn((_script: string, _keys: number, key: string) =>
      Promise.resolve(key.startsWith("zoho_books:rate:") ? 0 : [0, 1_000]),
    );
    const redis = { eval: evalScript, set: vi.fn() } as unknown as Redis;
    const transport = new FakeZohoTransport();
    const tokenStore = new InMemoryTokenStore();
    const client = createZohoBooksHttpClient({
      redis,
      config: testConfig(),
      transport,
      tokenStore,
    });
    await client.registerRefreshToken(ORG, TEST_REFRESH_TOKEN);

    const result = await client.get(ORG, "/invoices");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("daily_budget_spent");
    expect(evalScript).toHaveBeenCalledWith(
      expect.any(String),
      1,
      `zoho_books:rate:${ORG}`,
      expect.any(String),
      expect.any(String),
      expect.any(String),
    );
    expect(evalScript).toHaveBeenCalledWith(
      expect.any(String),
      1,
      expect.stringMatching(new RegExp(`^zoho_books:budget:${ORG}:`)),
      "1000",
      expect.any(String),
    );
    expect(transport.requests).toHaveLength(0);
  });

  it("fails closed when Redis cannot be reached: nothing is sent", async () => {
    const redis = {
      eval: vi.fn().mockRejectedValue(new Error("connection refused")),
      set: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as unknown as Redis;
    const transport = new FakeZohoTransport();
    const client = createZohoBooksHttpClient({
      redis,
      config: testConfig(),
      transport,
      tokenStore: new InMemoryTokenStore(),
    });
    await client.registerRefreshToken(ORG, TEST_REFRESH_TOKEN);

    const result = await client.get(ORG, "/invoices");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("rate_window_unavailable");
    expect(transport.requests).toHaveLength(0);
  });
});
