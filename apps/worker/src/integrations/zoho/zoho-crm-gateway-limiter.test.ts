import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrmGateway } from "../crm/crm-gateway.js";
import { ZohoCrmHttpError } from "./types.js";
import { ZohoCrmGatewayLimiter } from "./zoho-crm-gateway-limiter.js";

function fakeGateway(overrides: Partial<CrmGateway> = {}): CrmGateway {
  return {
    upsert: vi.fn(),
    upsertMany: vi.fn(),
    updateById: vi.fn(),
    findByEmail: vi.fn(),
    findDealIdsByContact: vi.fn(),
    executeCoql: vi.fn(),
    convertLead: vi.fn(),
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
});
