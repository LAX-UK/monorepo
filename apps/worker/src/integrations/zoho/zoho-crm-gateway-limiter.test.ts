import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrmBatchUpdate, CrmCoqlQuery, CrmGateway } from "../crm/crm-gateway.js";
import { ZohoCrmHttpError } from "./types.js";
import { ZohoCrmGatewayLimiter } from "./zoho-crm-gateway-limiter.js";

function fakeGateway(
  overrides: Partial<CrmGateway & CrmCoqlQuery & CrmBatchUpdate> = {},
): CrmGateway & CrmCoqlQuery & CrmBatchUpdate {
  return {
    upsert: vi.fn(),
    upsertMany: vi.fn(),
    updateById: vi.fn(),
    updateMany: vi.fn(),
    findByEmail: vi.fn(),
    findDealIdsByContact: vi.fn(),
    executeCoql: vi.fn(),
    queryCoql: vi.fn(),
    createRecord: vi.fn(),
    findLead: vi.fn(),
    deleteRecord: vi.fn(),
    purgeFromRecycleBin: vi.fn(),
    getMetrics: () => ({ apiCreditsRemaining: null }),
    ...overrides,
  };
}

describe("ZohoCrmGatewayLimiter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not open the circuit on 400-level record errors", async () => {
    const inner = fakeGateway({
      upsert: vi.fn().mockRejectedValue(new ZohoCrmHttpError(400, "bad request")),
    });
    const limiter = new ZohoCrmGatewayLimiter(inner);
    await expect(
      limiter.upsert({ module: "Leads", fields: {}, duplicateCheckFields: [] }),
    ).rejects.toThrow();
    await expect(
      limiter.upsert({ module: "Leads", fields: {}, duplicateCheckFields: [] }),
    ).rejects.toThrow();
  });

  it("opens the circuit after five transient failures", async () => {
    const inner = fakeGateway({
      upsert: vi.fn().mockRejectedValue(new ZohoCrmHttpError(429, "rate limited")),
    });
    const limiter = new ZohoCrmGatewayLimiter(inner);
    for (let i = 0; i < 5; i++) {
      await expect(
        limiter.upsert({ module: "Leads", fields: {}, duplicateCheckFields: [] }),
      ).rejects.toThrow();
    }
    await expect(
      limiter.upsert({ module: "Leads", fields: {}, duplicateCheckFields: [] }),
    ).rejects.toMatchObject({ message: "zoho_crm_circuit_open" });
  });

  it("honours Retry-After when opening the circuit", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const inner = fakeGateway({
      upsert: vi.fn().mockRejectedValue(new ZohoCrmHttpError(429, "rate limited", 120_000)),
    });
    const limiter = new ZohoCrmGatewayLimiter(inner);
    const input = { module: "Leads" as const, fields: {}, duplicateCheckFields: [] as string[] };
    for (let i = 0; i < 5; i++) {
      await expect(limiter.upsert(input)).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(150);
    }
    await expect(limiter.upsert(input)).rejects.toMatchObject({
      message: "zoho_crm_circuit_open",
    });

    await vi.advanceTimersByTimeAsync(60_000);
    await expect(limiter.upsert(input)).rejects.toMatchObject({
      message: "zoho_crm_circuit_open",
    });

    await vi.advanceTimersByTimeAsync(60_000);
    inner.upsert = vi.fn().mockResolvedValue({
      module: "Leads",
      recordId: "1",
      action: "upsert",
      status: "success",
    });
    await expect(limiter.upsert(input)).resolves.toMatchObject({ status: "success" });
  }, 15_000);
  it("spaces concurrent calls at least 100 ms apart", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const startedAt: number[] = [];
    const inner = fakeGateway({
      executeCoql: vi.fn().mockImplementation(async () => {
        startedAt.push(Date.now());
        return [];
      }),
    });
    const limiter = new ZohoCrmGatewayLimiter(inner);
    const calls = Array.from({ length: 6 }, () => limiter.executeCoql("select id from Products"));
    await vi.advanceTimersByTimeAsync(1_000);
    await Promise.all(calls);

    expect(startedAt).toHaveLength(6);
    const gaps = startedAt.slice(1).map((t, i) => t - (startedAt[i] as number));
    for (const gap of gaps) {
      expect(gap).toBeGreaterThanOrEqual(100);
    }
  });

  it("throws the retryable 503 before calling Zoho while the circuit is open", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const upsert = vi.fn().mockRejectedValue(new ZohoCrmHttpError(503, "unavailable"));
    const limiter = new ZohoCrmGatewayLimiter(fakeGateway({ upsert }));
    const input = { module: "Leads" as const, fields: {}, duplicateCheckFields: [] as string[] };
    for (let i = 0; i < 5; i++) {
      const call = expect(limiter.upsert(input)).rejects.toThrow();
      await vi.advanceTimersByTimeAsync(100);
      await call;
    }
    expect(upsert).toHaveBeenCalledTimes(5);

    await expect(limiter.upsert(input)).rejects.toMatchObject({
      message: "zoho_crm_circuit_open",
      status: 503,
      retryable: true,
    });
    expect(upsert).toHaveBeenCalledTimes(5);
  });

  it("re-checks the circuit after waiting for a slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const upsert = vi.fn().mockRejectedValue(new ZohoCrmHttpError(503, "unavailable"));
    const limiter = new ZohoCrmGatewayLimiter(fakeGateway({ upsert }));
    const input = { module: "Leads" as const, fields: {}, duplicateCheckFields: [] as string[] };
    // Five failing calls and a sixth queued behind them. The fifth failure opens
    // the circuit while the sixth is still waiting for its slot.
    const calls = Array.from({ length: 6 }, () =>
      limiter.upsert(input).catch((err: unknown) => err),
    );
    await vi.advanceTimersByTimeAsync(1_000);
    const results = await Promise.all(calls);

    expect(upsert).toHaveBeenCalledTimes(5);
    expect(results[5]).toMatchObject({
      message: "zoho_crm_circuit_open",
      status: 503,
      retryable: true,
    });
  });
});
