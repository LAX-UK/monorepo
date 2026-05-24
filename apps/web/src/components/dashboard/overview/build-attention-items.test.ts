import type { DashboardOverviewVm } from "@/lib/data/view-models/dashboard-overview.vm";
import { describe, expect, it } from "vitest";
import { buildAttentionItems } from "./build-attention-items";

const emptyVm = {
  activeLots: [],
  activeLotBidHints: {},
  settlementsDue: [],
  endingSoonWatchlist: [],
} as unknown as DashboardOverviewVm;

describe("buildAttentionItems KYC", () => {
  it("includes pending KYC attention item", () => {
    const items = buildAttentionItems({
      vm: emptyVm,
      kyc: {
        status: "pending",
        verifiedAt: null,
        latestSessionId: "s1",
        pendingExposure: { total: 0, currency: "GBP" },
        thresholdAmount: 1000,
        thresholdCurrency: "GBP",
        requiresKyc: false,
      },
      orgOnboarding: null,
    });
    expect(items.some((i) => i.id === "kyc-pending")).toBe(true);
  });

  it("includes required KYC attention item when over threshold", () => {
    const items = buildAttentionItems({
      vm: emptyVm,
      kyc: {
        status: "unverified",
        verifiedAt: null,
        latestSessionId: null,
        pendingExposure: { total: 1500, currency: "GBP" },
        thresholdAmount: 1000,
        thresholdCurrency: "GBP",
        requiresKyc: true,
      },
      orgOnboarding: null,
    });
    expect(items.some((i) => i.id === "kyc-required")).toBe(true);
  });
});
