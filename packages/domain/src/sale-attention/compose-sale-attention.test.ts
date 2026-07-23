import { describe, expect, it } from "vitest";
import { resolveNeededSignalKeys } from "./active-signal-keys.js";
import { composeSaleAttention } from "./compose-sale-attention.js";
import { DEFAULT_SALE_ATTENTION_CONTRIBUTORS } from "./sale-attention-registry.js";
import type { SaleAttentionSignals } from "./sale-attention-types.js";

const principal = { role: "staff" as const, staffRole: "super_admin" };

function draftSignals(overrides: Partial<SaleAttentionSignals> = {}): SaleAttentionSignals {
  return {
    sale: {
      id: "sale-1",
      title: "Test",
      status: "draft",
      deliveryMode: "online",
      startTime: new Date("2026-12-01T10:00:00Z"),
      endTime: new Date("2026-12-02T18:00:00Z"),
    } as SaleAttentionSignals["sale"],
    lots: [],
    venueReady: true,
    startInFuture: true,
    pendingRegistrationCount: 0,
    ...overrides,
  };
}

describe("composeSaleAttention", () => {
  it("returns setup items for draft sale missing lots", () => {
    const result = composeSaleAttention(draftSignals(), DEFAULT_SALE_ATTENTION_CONTRIBUTORS, {
      principal,
    });
    expect(result.items.some((i) => i.id === "setup-sale-lots")).toBe(true);
    expect(result.items[0]?.severity).toBe("critical");
  });

  it("filters finance contributors for staff without finance access", () => {
    const signals: SaleAttentionSignals = {
      sale: {
        id: "sale-1",
        status: "ended",
        deliveryMode: "online",
        startTime: new Date(),
        endTime: new Date(),
      } as SaleAttentionSignals["sale"],
      unsettledSoldLotCount: 3,
      financeReviewCount: 2,
    };
    const result = composeSaleAttention(signals, DEFAULT_SALE_ATTENTION_CONTRIBUTORS, {
      principal: { role: "staff", staffRole: "catalogue_manager" },
    });
    expect(result.items).toHaveLength(0);
  });

  it("truncates and reports totalCount", () => {
    const signals = draftSignals({
      deleteBlockers: ["a", "b", "c"],
    });
    const result = composeSaleAttention(signals, DEFAULT_SALE_ATTENTION_CONTRIBUTORS, {
      principal,
      limit: 1,
    });
    expect(result.truncated).toBe(true);
    expect(result.totalCount).toBeGreaterThan(1);
    expect(result.items).toHaveLength(1);
  });
});

describe("resolveNeededSignalKeys", () => {
  it("draft sale does not need settlement signals", () => {
    const keys = resolveNeededSignalKeys("draft", DEFAULT_SALE_ATTENTION_CONTRIBUTORS, principal);
    expect(keys).not.toContain("settlement");
    expect(keys).toContain("sale");
    expect(keys).toContain("lots");
  });
});
