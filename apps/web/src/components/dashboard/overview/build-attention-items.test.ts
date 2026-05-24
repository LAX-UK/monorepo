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
  it("includes pending KYC attention item when truly in review", () => {
    const items = buildAttentionItems({
      vm: emptyVm,
      kyc: {
        status: "pending",
        verifiedAt: null,
        latestSessionId: "s1",
        latestSessionStatus: "processing",
        feedback: {
          headline: "In review",
          detail: null,
          action: "wait",
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: false,
        },
        pendingExposure: { total: 0, currency: "GBP" },
        thresholdAmount: 1000,
        thresholdCurrency: "GBP",
        requiresKyc: false,
      },
      orgOnboarding: null,
    });
    expect(items.some((i) => i.id === "kyc-pending")).toBe(true);
  });

  it("shows continuable item instead of in-review for created session", () => {
    const items = buildAttentionItems({
      vm: emptyVm,
      kyc: {
        status: "pending",
        verifiedAt: null,
        latestSessionId: "s1",
        latestSessionStatus: "created",
        feedback: {
          headline: "Verification started",
          detail: "Complete checks",
          action: "continue",
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: false,
        },
        pendingExposure: { total: 0, currency: "GBP" },
        thresholdAmount: 1000,
        thresholdCurrency: "GBP",
        requiresKyc: false,
      },
      orgOnboarding: null,
    });
    expect(items.some((i) => i.id === "kyc-pending")).toBe(false);
    expect(items.some((i) => i.id === "kyc-continuable")).toBe(true);
  });

  it("includes resubmit attention item when Veriff needs more input", () => {
    const items = buildAttentionItems({
      vm: emptyVm,
      kyc: {
        status: "pending",
        verifiedAt: null,
        latestSessionId: "s1",
        latestSessionStatus: "requires_input",
        feedback: {
          headline: "More information needed",
          detail: "Face not clearly visible",
          action: "continue",
          reasonCode: 202,
          decisionStatus: "resubmission_requested",
          needsResubmit: true,
        },
        pendingExposure: { total: 0, currency: "GBP" },
        thresholdAmount: 1000,
        thresholdCurrency: "GBP",
        requiresKyc: false,
      },
      orgOnboarding: null,
    });
    expect(items.some((i) => i.id === "kyc-resubmit")).toBe(true);
  });

  it("includes required KYC attention item when over threshold", () => {
    const items = buildAttentionItems({
      vm: emptyVm,
      kyc: {
        status: "unverified",
        verifiedAt: null,
        latestSessionId: null,
        latestSessionStatus: null,
        feedback: {
          headline: "Verification required",
          detail: null,
          action: "start",
          reasonCode: null,
          decisionStatus: null,
          needsResubmit: false,
        },
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
