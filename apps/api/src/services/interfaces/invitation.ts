import type { UserRole, UserStaffRole } from "@auction/types";

export type InvitationRow = {
  id: string;
  email: string;
  targetRole: UserRole;
  targetStaffRole: UserStaffRole | null;
  tokenHash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: Date;
  openedAt: Date | null;
  lastEmailOutboxId: string | null;
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
  openedAt?: Date | null;
  lastEmailOutboxId?: string | null;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  targetLegalEntityId?: string | null;
  targetLegalEntityMemberRole?: string | null;
  createdByUserId: string;
};

/** Safe for internal reads (no token hash). Omits operational FK only used for joins. */
export type InvitationSummary = Omit<InvitationRow, "tokenHash" | "lastEmailOutboxId">;

/** Admin list projection including invite-email delivery snapshot from linked outbox row. */
export type InvitationAdminListRow = InvitationSummary & {
  inviteEmailLastStatus: string | null;
};

export interface IUserInvitationRepository {
  insert(row: InvitationInsert): Promise<void>;
  findById(id: string): Promise<InvitationRow | null>;
  findPendingByTokenHash(tokenHash: string): Promise<InvitationRow | null>;
  listAdminCreatedBy(userId: string): Promise<InvitationAdminListRow[]>;
  updateStatus(
    id: string,
    patch: Partial<
      Pick<
        InvitationRow,
        | "status"
        | "acceptedAt"
        | "acceptedUserId"
        | "tokenHash"
        | "expiresAt"
        | "openedAt"
        | "lastEmailOutboxId"
      >
    >,
  ): Promise<void>;
  markOpenedFirstTouch(id: string): Promise<void>;
}
