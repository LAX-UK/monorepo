import { evaluateKycThresholdRequirement } from "@auction/bidding-runtime";
import { describe, expect, it } from "vitest";
import { WorkerKycThresholdGate } from "../compliance/worker-kyc-threshold-gate.js";

/** Same threshold vectors must agree between API KycGateService and worker WorkerKycThresholdGate. */
const THRESHOLD_VECTORS = [
  {
    label: "below threshold",
    userKycStatus: "unverified" as const,
    latestSessionStatus: null,
    exposureTotal: 500,
    thresholdAmount: 1000,
    requiresKyc: false,
  },
  {
    label: "above threshold unverified",
    userKycStatus: "unverified" as const,
    latestSessionStatus: null,
    exposureTotal: 2000,
    thresholdAmount: 1000,
    requiresKyc: true,
  },
  {
    label: "pending session created treated as unverified",
    userKycStatus: "pending" as const,
    latestSessionStatus: "created",
    exposureTotal: 2000,
    thresholdAmount: 1000,
    requiresKyc: true,
  },
  {
    label: "approved clears requirement",
    userKycStatus: "approved" as const,
    latestSessionStatus: "approved",
    exposureTotal: 50_000,
    thresholdAmount: 1000,
    requiresKyc: false,
  },
];

describe("worker/API KYC threshold parity", () => {
  for (const vector of THRESHOLD_VECTORS) {
    it(vector.label, () => {
      const { requiresKyc } = evaluateKycThresholdRequirement({
        userKycStatus: vector.userKycStatus,
        latestSessionStatus: vector.latestSessionStatus,
        exposureTotal: vector.exposureTotal,
        thresholdAmount: vector.thresholdAmount,
      });
      expect(requiresKyc).toBe(vector.requiresKyc);
    });
  }

  it("worker gate throws kyc_required when shared policy requires KYC", async () => {
    const vector = THRESHOLD_VECTORS.find((v) => v.requiresKyc);
    if (!vector) throw new Error("missing vector");
    const gate = new WorkerKycThresholdGate(
      {
        getUserKycState: async () => ({ kycStatus: vector.userKycStatus }),
        findLatestByUserIdWithPayload: async () =>
          vector.latestSessionStatus
            ? { verification: { status: vector.latestSessionStatus } }
            : null,
        getPendingExposure: async () => ({
          total: vector.exposureTotal,
          currency: "GBP",
        }),
      } as never,
      vector.thresholdAmount,
    );
    await expect(gate.enforceThreshold("user-1")).rejects.toMatchObject({ code: "kyc_required" });
  });
});
