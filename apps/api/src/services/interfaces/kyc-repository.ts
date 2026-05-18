import type { Database } from "@auction/db";
import type { KycVerification, UserKycStatus } from "@auction/types";

export type CreateKycVerificationInput = {
  userId: string;
  stripeVerificationSessionId: string;
  status: KycVerification["status"];
};

export type UpdateKycVerificationPatch = {
  status?: KycVerification["status"];
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
  findById(id: string): Promise<KycVerification | null>;
  findByStripeSessionId(stripeSessionId: string): Promise<KycVerification | null>;
  findLatestByUserId(userId: string): Promise<KycVerification | null>;
  update(id: string, patch: UpdateKycVerificationPatch): Promise<KycVerification>;

  /** Sum of pending exposure for a user across:
   * - Active winning bids on lots not yet paid (bid.amount on `bid` rows for lots
   * with `status='active'` or `status='ended'` that have no completed payment).
   * - Pending payment rows (status not in {'completed','failed','refunded'}).
   * - Pending submission asking prices (status='pending').
   * * Used to enforce the KYC threshold gate.
   */
  getPendingExposure(userId: string): Promise<{ total: number; currency: string }>;

  /** Set the user's `kyc_status` and `kyc_verified_at` columns. */
  setUserKycStatus(
    userId: string,
    status: "unverified" | "pending" | "approved" | "rejected",
    verifiedAt: Date | null,
    conn?: Database,
  ): Promise<void>;

  /** Insert verification row and set `user.current_kyc_session_id` + pending in one transaction. */
  createWithCurrentStripeSession(input: CreateKycVerificationInput): Promise<KycVerification>;

  getUserKycWebhookState(userId: string): Promise<{
    currentKycSessionId: string | null;
    kycRetryCount: number;
  } | null>;

  incrementUserKycRetryCount(userId: string): Promise<void>;

  /** User table KYC columns (source of truth for portal status). */
  getUserKycState(userId: string): Promise<{
    kycStatus: UserKycStatus;
    kycVerifiedAt: Date | null;
  } | null>;
}
