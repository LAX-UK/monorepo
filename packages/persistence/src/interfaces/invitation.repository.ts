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
  invitedByName: string | null;
};

export type InvitationAdminListFilters = {
  status?: InvitationRow["status"];
  q?: string;
};

/** Outcome of the atomic single-use consume transaction. */
export type ConsumeInviteResult =
  | { outcome: "ok"; targetRole: UserRole }
  | { outcome: "invalid" }
  | { outcome: "expired" }
  | { outcome: "email_mismatch" };

export interface IUserInvitationRepository {
  insert(row: InvitationInsert): Promise<void>;
  findById(id: string): Promise<InvitationRow | null>;
  findPendingByTokenHash(tokenHash: string): Promise<InvitationRow | null>;
  /** Pending platform invite (entity invites excluded) for an email, case-insensitive. */
  findPendingPlatformByEmail(email: string): Promise<InvitationRow | null>;
  /**
   * Atomically consumes a pending invite for a freshly registered user: marks it
   * accepted and applies the target role to the user row, in one transaction with
   * a row lock so a token can never be redeemed twice.
   */
  consumeForNewUser(
    tokenHash: string,
    newUserId: string,
    email: string,
  ): Promise<ConsumeInviteResult>;
  listAdmin(
    filters: InvitationAdminListFilters,
    page: { limit: number; offset: number },
  ): Promise<InvitationAdminListRow[]>;
  /** Exact list totals (pagination + KPI badges). `total` respects filters; pending/accepted are global. */
  counts(filters: InvitationAdminListFilters): Promise<{
    total: number;
    pending: number;
    accepted: number;
  }>;
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
