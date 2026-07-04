import type { IKycRepository } from "@auction/persistence/interfaces";
import { KycRequiredError, type KycStatusSummary } from "../interfaces/kyc-service.js";
import { buildKycUserFeedback } from "./kyc-user-feedback.js";
import type { IKycGateService } from "./ports.js";

export class KycGateService implements IKycGateService {
  constructor(
    private readonly repo: IKycRepository,
    private readonly thresholdAmount: number,
    private readonly thresholdCurrency: string,
  ) {}

  async getStatus(userId: string): Promise<KycStatusSummary> {
    const userState = await this.repo.getUserKycState(userId);
    const latest = await this.repo.findLatestByUserIdWithPayload(userId);
    const exposure = await this.repo.getPendingExposure(userId);
    const status: KycStatusSummary["status"] = userState?.kycStatus ?? "unverified";
    const verifiedAt = status === "approved" ? (userState?.kycVerifiedAt ?? null) : null;
    const latestSessionStatus = latest?.verification.status ?? null;
    const effectiveUserStatus: KycStatusSummary["status"] =
      status === "pending" && latestSessionStatus === "created" ? "unverified" : status;
    const requiresKyc =
      exposure.total >= this.thresholdAmount && effectiveUserStatus !== "approved";
    const feedback = buildKycUserFeedback({
      userStatus: effectiveUserStatus,
      latestSessionStatus,
      requiresKyc,
      decisionPayload: latest?.decisionPayload ?? null,
    });
    return {
      status,
      verifiedAt,
      latestSessionId: latest?.verification.providerSessionId ?? null,
      latestSessionStatus,
      feedback,
      pendingExposure: exposure,
      thresholdAmount: this.thresholdAmount,
      thresholdCurrency: this.thresholdCurrency,
      requiresKyc,
    };
  }

  async enforceThreshold(userId: string): Promise<void> {
    const summary = await this.getStatus(userId);
    if (summary.requiresKyc) throw new KycRequiredError(summary);
  }
}
