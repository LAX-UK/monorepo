import type { AdminAmlScreeningRow } from "@/lib/data/http/compliance.server";
import type { LegalEntity } from "@auction/types";

export type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  staffRole: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  image: string | null;
  mobile: string | null;
  mobileCountry: string | null;
  emailVerified: boolean;
  emailStatus: string;
  signupPersona: string | null;
  twoFactorEnabled: boolean;
  kycStatus: string;
  kycVerifiedAt: string | null;
  kycRetryCount: number;
  deletionRequestedAt: string | null;
};

export type GetAdminUserListParams = {
  q?: string;
  limit?: number;
  offset?: number;
  role?: string;
  staffRole?: string;
  suspendedOnly?: boolean;
  accountStatus?: "active" | "suspended";
  emailVerified?: boolean;
  emailStatus?: "ok" | "bounced" | "complained";
  kycStatus?: string;
  kycStatuses?: string[];
  persona?: "individual" | "organisation" | "none";
  twoFactorEnabled?: boolean;
  deletionRequestedOnly?: boolean;
  hasMobile?: boolean;
  createdFrom?: string;
  createdTo?: string;
  kycVerifiedFrom?: string;
  kycVerifiedTo?: string;
  lastActiveFrom?: string;
  lastActiveTo?: string;
  sort?: string;
};

export type AdminUserDetailPayload = AdminUserRow & {
  suspendedReason: string | null;
  dateOfBirth: string | null;
  emailStatusChangedAt: string | null;
  pendingNewEmail: string | null;
  emailChangeExpiresAt: string | null;
  currentKycSessionId: string | null;
  amlHoldStatus: string | null;
  amlHoldReason: string | null;
  amlHoldAt: string | null;
};

export type AdminKycSessionRow = {
  id: string;
  provider: string;
  providerSessionId: string;
  providerAttemptId: string | null;
  status: string;
  verifiedFirstName: string | null;
  verifiedLastName: string | null;
  verifiedDateOfBirth: string | null;
  verifiedIdNumberLast4: string | null;
  verifiedIdCountry: string | null;
  verifiedIdType: string | null;
  verifiedIdExpiry: string | null;
  verifiedGender: string | null;
  verifiedNationality: string | null;
  verifiedCitizenship: string | null;
  verifiedPlaceOfBirth: string | null;
  verifiedYearOfBirth: string | null;
  verifiedIdNumber: string | null;
  verifiedDocState: string | null;
  verifiedIdValidFrom: string | null;
  decisionRiskScore: string | null;
  decisionIpCountry: string | null;
  decisionStatus: string | null;
  decisionReasonCode: number | null;
  decisionReasonLabel: string | null;
  createdAt: string;
  decisionAt: string | null;
};

export type AdminUserLookupRow = {
  id: string;
  name: string;
  email: string;
};

export type AdminUserActivityEntry = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
};

export type AdminUserBidRow = {
  id: string;
  lotId: string;
  lotTitle: string;
  saleId: string | null;
  saleTitle: string | null;
  amount: string;
  isWinning: boolean;
  isAutoBid: boolean;
  placedVia: string | null;
  createdAt: Date;
};

export type { AdminAmlScreeningRow, LegalEntity };
