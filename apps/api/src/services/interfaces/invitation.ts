import type { UserRole, UserStaffRole } from "@auction/types";

export type InvitationRow = {
  id: string;
  email: string;
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  tokenHash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  targetLegalEntityId: string | null;
  targetLegalEntityMemberRole: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type InvitationInsert = {
  id: string;
  email: string;
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  tokenHash: string;
  status: InvitationRow["status"];
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  targetLegalEntityId?: string | null;
  targetLegalEntityMemberRole?: string | null;
  createdByUserId: string;
};

/** Safe for admin list endpoints (no token hash). */
export type InvitationSummary = Omit<InvitationRow, "tokenHash">;

export interface IUserInvitationRepository {
  insert(row: InvitationInsert): Promise<void>;
  findById(id: string): Promise<InvitationRow | null>;
  findPendingByTokenHash(tokenHash: string): Promise<InvitationRow | null>;
  listPendingCreatedBy(userId: string): Promise<InvitationSummary[]>;
  updateStatus(
    id: string,
    patch: Partial<
      Pick<InvitationRow, "status" | "acceptedAt" | "acceptedUserId" | "tokenHash" | "expiresAt">
    >,
  ): Promise<void>;
}
