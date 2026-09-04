import type { UserEmailStatus, UserKycStatus } from "@auction/types";

export type AdminUserListSort =
  | "created_desc"
  | "created_asc"
  | "name_asc"
  | "name_desc"
  | "kyc_status";

export type AdminUserAccountStatus = "active" | "suspended";

export type AdminUserListFilter = {
  q?: string | undefined;
  limit: number;
  offset: number;
  role?: string | undefined;
  staffRole?: string | undefined;
  /** When true, only users with non-null `suspendedAt`. Legacy; prefer `accountStatus`. */
  suspendedOnly?: boolean | undefined;
  accountStatus?: AdminUserAccountStatus | undefined;
  emailVerified?: boolean | undefined;
  emailStatus?: UserEmailStatus | undefined;
  kycStatus?: UserKycStatus | undefined;
  kycStatuses?: UserKycStatus[] | undefined;
  persona?: "individual" | "organisation" | "none" | undefined;
  deletionRequestedOnly?: boolean | undefined;
  hasMobile?: boolean | undefined;
  createdFrom?: Date | undefined;
  createdToExclusive?: Date | undefined;
  kycVerifiedFrom?: Date | undefined;
  kycVerifiedToExclusive?: Date | undefined;
  sort?: AdminUserListSort | undefined;
};

export type AdminUserListRow = {
  id: string;
  email: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  staffRole: string | null;
  createdAt: Date;
  updatedAt: Date;
  suspendedAt: Date | null;
  image: string | null;
  mobile: string | null;
  mobileCountry: string | null;
  emailVerified: boolean;
  emailStatus: string;
  signupPersona: string | null;
  kycStatus: string;
  kycVerifiedAt: Date | null;
  kycRetryCount: number;
  deletionRequestedAt: Date | null;
};

export type AdminUserListResult = {
  rows: AdminUserListRow[];
  total: number;
};

export type AdminUserDetail = AdminUserListRow & {
  suspendedReason: string | null;
  dateOfBirth: string | null;
  emailStatusChangedAt: Date | null;
  pendingNewEmail: string | null;
  emailChangeExpiresAt: Date | null;
  currentKycSessionId: string | null;
  amlHoldStatus: string | null;
  amlHoldReason: string | null;
  amlHoldAt: Date | null;
};

export type AdminKycSession = {
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
  createdAt: Date;
  decisionAt: Date | null;
};

export type AdminActivityEntry = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
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

export type AdminUserBidListResult = {
  rows: AdminUserBidRow[];
  total: number;
};

export interface IAdminUserBidsReader {
  listForUser(
    userId: string,
    page: { limit: number; offset: number },
  ): Promise<AdminUserBidListResult>;
}

export interface IAdminUserReader {
  list(filter: AdminUserListFilter): Promise<AdminUserListResult>;
  getById(id: string): Promise<AdminUserDetail | null>;
  getByIds(ids: string[]): Promise<AdminUserListRow[]>;
}

export interface IAdminUserKycReader {
  listSessionsForUser(userId: string, limit?: number): Promise<AdminKycSession[]>;
}

export interface IAdminUserRoleManager {
  /** Atomically sets `role` and `staff_role` (`staff_role` null iff `role` is `client`). */
  setRoleAndStaff(userId: string, role: string, staffRole: string | null): Promise<void>;
}

export interface IAdminUserSuspender {
  suspend(userId: string, reason: string | null): Promise<void>;
  unsuspend(userId: string): Promise<void>;
}

export interface IAdminUserActivityReader {
  getRecentSessions(userId: string, limit: number): Promise<AdminActivityEntry[]>;
}
