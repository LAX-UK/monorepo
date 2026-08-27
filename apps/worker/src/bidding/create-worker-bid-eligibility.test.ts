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

  it("applies strict email eligibility before absentee replay proceeds", async () => {
    const identityEligibilityGate = {
      assertSelfServiceEligible: vi.fn().mockResolvedValue({
        isOk: () => false,
        isErr: () => true,
        error: { code: "email_not_verified", status: 403 },
      }),
      assertValidatedOperatorEligible: vi.fn(),
    };
    const eligibility = createWorkerBidEligibility({
      db: {} as never,
      env: {
        KYC_THRESHOLD_AMOUNT: 1000,
        ABSENTEE_REPLAY_OWNER: "worker",
        STRICT_BID_ELIGIBILITY_ENABLED: true,
        APP_ENV: "production",
      },
      identityEligibilityGate,
      amlHoldStore: {
        getHold: vi.fn().mockResolvedValue(null),
        setHold: vi.fn(),
        clearHold: vi.fn(),
      },
    });

    const result = await eligibility.assertCanPlaceBid({
      placedByUserId: "user-1",
      buyerLegalEntityId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      lotId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      amount: 1000,
    });

    expect(identityEligibilityGate.assertSelfServiceEligible).toHaveBeenCalledWith("user-1");
    expect(result.isErr() && result.error.code).toBe("email_not_verified");
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
