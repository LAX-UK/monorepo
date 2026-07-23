import { type IKycThresholdGate, evaluateKycThresholdRequirement } from "@auction/bidding-runtime";
import type { IKycRepository } from "@auction/persistence/interfaces";

/** Thrown when buyer exposure exceeds threshold without approved KYC (matches API KycRequiredError code). */
export class WorkerKycRequiredError extends Error {
  readonly code = "kyc_required";
  constructor() {
    super("kyc_required");
    this.name = "WorkerKycRequiredError";
  }
}

/** DB-backed KYC threshold gate for worker bid/absentee replay (no Veriff API calls). */
export class WorkerKycThresholdGate implements IKycThresholdGate {
  constructor(
    private readonly repo: IKycRepository,
    private readonly thresholdAmount: number,
  ) {}

  async enforceThreshold(userId: string): Promise<void> {
    const userState = await this.repo.getUserKycState(userId);
    const latest = await this.repo.findLatestByUserIdWithPayload(userId);
    const exposure = await this.repo.getPendingExposure(userId);
    const { requiresKyc } = evaluateKycThresholdRequirement({
      userKycStatus: userState?.kycStatus ?? "unverified",
      latestSessionStatus: latest?.verification.status ?? null,
      exposureTotal: exposure.total,
      thresholdAmount: this.thresholdAmount,
    });
    if (requiresKyc) throw new WorkerKycRequiredError();
  }
}
