import type { Database } from "@auction/db";
import type { KycVerification, UserKycStatus } from "@auction/types";

export type CreateKycVerificationInput = {
  userId: string;
  provider: string;
  providerSessionId: string;
  status: KycVerification["status"];
};

export type UpdateKycVerificationPatch = {
  status?: KycVerification["status"];
  providerAttemptId?: string | null;
  verifiedFirstName?: string | null;
  verifiedLastName?: string | null;
  verifiedDateOfBirth?: Date | null;
  verifiedIdNumberLast4?: string | null;
  verifiedIdCountry?: string | null;
  verifiedIdType?: string | null;
  verifiedIdExpiry?: Date | null;
  decisionPayload?: Record<string, unknown> | null;
  decisionAt?: Date | null;
};

export interface IKycRepository {
  create(input: CreateKycVerificationInput): Promise<KycVerification>;
  findById(id: string, conn?: Database): Promise<KycVerification | null>;
  findByProviderSessionId(sessionId: string, conn?: Database): Promise<KycVerification | null>;
  findLatestByUserId(userId: string, conn?: Database): Promise<KycVerification | null>;
  findLatestByUserIdWithPayload(
    userId: string,
    conn?: Database,
  ): Promise<{
    verification: KycVerification;
    decisionPayload: Record<string, unknown> | null;
  } | null>;
  getDecisionPayload(id: string, conn?: Database): Promise<Record<string, unknown> | null>;
  update(id: string, patch: UpdateKycVerificationPatch, conn?: Database): Promise<KycVerification>;

  /** Sum of pending exposure for a user across bids, payments, and submissions. */
  getPendingExposure(userId: string): Promise<{ total: number; currency: string }>;

  setUserKycStatus(
    userId: string,
    status: "unverified" | "pending" | "approved" | "rejected",
    verifiedAt: Date | null,
    conn?: Database,
  ): Promise<void>;

  /** Insert verification row and set `user.current_kyc_session_id` + pending in one transaction. */
  createWithCurrentSession(input: CreateKycVerificationInput): Promise<KycVerification>;

  getUserKycWebhookState(
    userId: string,
    conn?: Database,
  ): Promise<{
    currentKycSessionId: string | null;
    kycRetryCount: number;
  } | null>;

  incrementUserKycRetryCount(userId: string, conn?: Database): Promise<void>;

  getUserKycState(
    userId: string,
    conn?: Database,
  ): Promise<{
    kycStatus: UserKycStatus;
    kycVerifiedAt: Date | null;
  } | null>;
}
