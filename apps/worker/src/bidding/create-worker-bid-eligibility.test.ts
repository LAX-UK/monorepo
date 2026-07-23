import { BidEligibilityService, isKycBidEnforcementEnabled } from "@auction/bidding-runtime";
import { describe, expect, it, vi } from "vitest";
import { WorkerKycThresholdGate } from "../compliance/worker-kyc-threshold-gate.js";
import {
  createWorkerBidEligibility,
  isWorkerBidKycEnforcementActive,
} from "./create-worker-bid-eligibility.js";

describe("createWorkerBidEligibility", () => {
  it("returns a BidEligibilityService", () => {
    const eligibility = createWorkerBidEligibility({
      db: {} as never,
      env: { KYC_THRESHOLD_AMOUNT: 1000, ABSENTEE_REPLAY_OWNER: "api_rollback" },
      amlHoldStore: {
        getHold: vi.fn().mockResolvedValue(null),
        setHold: vi.fn(),
        clearHold: vi.fn(),
      },
    });
    expect(eligibility).toBeInstanceOf(BidEligibilityService);
  });

  it("requires KYC enforcement when absentee replay owner is worker", () => {
    expect(
      isWorkerBidKycEnforcementActive({
        ABSENTEE_REPLAY_OWNER: "worker",
        KYC_THRESHOLD_AMOUNT: 1000,
      }),
    ).toBe(true);
    expect(isKycBidEnforcementEnabled(0)).toBe(false);
  });
});

describe("WorkerKycThresholdGate", () => {
  it("throws kyc_required when exposure exceeds threshold without approval", async () => {
    const gate = new WorkerKycThresholdGate(
      {
        getUserKycState: vi.fn().mockResolvedValue({ kycStatus: "unverified" }),
        findLatestByUserIdWithPayload: vi.fn().mockResolvedValue(null),
        getPendingExposure: vi.fn().mockResolvedValue({ total: 2000, currency: "GBP" }),
      } as never,
      1000,
    );
    await expect(gate.enforceThreshold("user-1")).rejects.toMatchObject({ code: "kyc_required" });
  });
});
