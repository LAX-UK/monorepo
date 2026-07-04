import type { MarketingContactSyncStatus } from "@auction/db/schema";

export type MarketingContactSyncUserRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  role: string;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  kycStatus: string;
  signupPersona: string | null;
  emailStatus: string;
  suspendedAt: Date | null;
  deletionRequestedAt: Date | null;
  createdAt: Date;
};

export type MarketingContactSyncAuditInput = {
  userId: string;
  provider: string;
  action: string;
  status: MarketingContactSyncStatus;
  reason: string;
  providerContactId?: string | null;
  responseCode?: number | null;
  error?: string | null;
};

export interface IMarketingContactSyncRepository {
  findUserById(userId: string): Promise<MarketingContactSyncUserRow | null>;
  isEmailSuppressed(email: string): Promise<boolean>;
  writeAuditLog(input: MarketingContactSyncAuditInput): Promise<void>;
}
