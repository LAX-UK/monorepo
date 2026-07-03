import type {
  CreateKycVerificationInput,
  IKycSessionRepository,
  UpdateKycVerificationPatch,
} from "../../repositories/interfaces/kyc-session.repository.js";

export type { CreateKycVerificationInput, UpdateKycVerificationPatch };

export interface IKycRepository extends IKycSessionRepository {
  /** Sum of pending exposure for a user across bids, payments, and submissions. */
  getPendingExposure(userId: string): Promise<{ total: number; currency: string }>;
}
