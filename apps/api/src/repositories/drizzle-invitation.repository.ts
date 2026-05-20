import type { Database } from "@auction/db";
import { emailOutbox, userInvitation } from "@auction/db/schema";
import type { UserRole, UserStaffRole } from "@auction/types";
import { and, desc, eq } from "drizzle-orm";
import type {
  IUserInvitationRepository,
  InvitationAdminListRow,
  InvitationInsert,
  InvitationRow,
  InvitationSummary,
} from "../services/interfaces/invitation.js";

function mapRow(r: typeof userInvitation.$inferSelect): InvitationRow {
  return {
    id: r.id,
    email: r.email,
    targetRole: r.targetRole as UserRole,
    targetStaffRole: (r.targetStaffRole ?? null) as InvitationRow["targetStaffRole"],
    tokenHash: r.tokenHash,
    status: r.status,
    expiresAt: r.expiresAt,
    openedAt: r.openedAt ?? null,
    lastEmailOutboxId: r.lastEmailOutboxId ?? null,
    acceptedAt: r.acceptedAt ?? null,
    acceptedUserId: r.acceptedUserId ?? null,
    targetLegalEntityId: r.targetLegalEntityId ?? null,
    targetLegalEntityMemberRole: r.targetLegalEntityMemberRole ?? null,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapInvitationSummary(r: {
  id: string;
  email: string;
  targetRole: string;
  targetStaffRole: string | null;
  status: InvitationRow["status"];
  expiresAt: Date;
  openedAt: Date | null;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
  targetLegalEntityId: string | null;
  targetLegalEntityMemberRole: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): InvitationSummary {
  return {
    id: r.id,
    email: r.email,
    targetRole: r.targetRole as UserRole,
    targetStaffRole: (r.targetStaffRole ?? null) as UserStaffRole | null,
    status: r.status,
    expiresAt: r.expiresAt,
    openedAt: r.openedAt ?? null,
    acceptedAt: r.acceptedAt ?? null,
    acceptedUserId: r.acceptedUserId ?? null,
    targetLegalEntityId: r.targetLegalEntityId ?? null,
    targetLegalEntityMemberRole: r.targetLegalEntityMemberRole ?? null,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export class DrizzleUserInvitationRepository implements IUserInvitationRepository {
  constructor(private readonly db: Database) {}

  async insert(row: InvitationInsert): Promise<void> {
    await this.db.insert(userInvitation).values({
      id: row.id,
      email: row.email,
      targetRole: row.targetRole,
      targetStaffRole: row.targetStaffRole,
      tokenHash: row.tokenHash,
      status: row.status,
      expiresAt: row.expiresAt,
      openedAt: row.openedAt ?? null,
      lastEmailOutboxId: row.lastEmailOutboxId ?? null,
      acceptedAt: row.acceptedAt,
      acceptedUserId: row.acceptedUserId,
      targetLegalEntityId: row.targetLegalEntityId ?? null,
      targetLegalEntityMemberRole: row.targetLegalEntityMemberRole ?? null,
      createdByUserId: row.createdByUserId,
    });
  }

  async findById(id: string): Promise<InvitationRow | null> {
    const [row] = await this.db
      .select()
      .from(userInvitation)
      .where(eq(userInvitation.id, id))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async findPendingByTokenHash(tokenHash: string): Promise<InvitationRow | null> {
    const [row] = await this.db
      .select()
      .from(userInvitation)
      .where(and(eq(userInvitation.tokenHash, tokenHash), eq(userInvitation.status, "pending")))
      .limit(1);
    return row ? mapRow(row) : null;
  }

  async listAdminCreatedBy(userId: string): Promise<InvitationAdminListRow[]> {
    const inviteEmailLastStatus = emailOutbox.status;
    const rows = await this.db
      .select({
        id: userInvitation.id,
        email: userInvitation.email,
        targetRole: userInvitation.targetRole,
        targetStaffRole: userInvitation.targetStaffRole,
        status: userInvitation.status,
        expiresAt: userInvitation.expiresAt,
        openedAt: userInvitation.openedAt,
        acceptedAt: userInvitation.acceptedAt,
        acceptedUserId: userInvitation.acceptedUserId,
        targetLegalEntityId: userInvitation.targetLegalEntityId,
        targetLegalEntityMemberRole: userInvitation.targetLegalEntityMemberRole,
        createdByUserId: userInvitation.createdByUserId,
        createdAt: userInvitation.createdAt,
        updatedAt: userInvitation.updatedAt,
        inviteEmailLastStatus,
      })
      .from(userInvitation)
      .leftJoin(emailOutbox, eq(userInvitation.lastEmailOutboxId, emailOutbox.id))
      .where(eq(userInvitation.createdByUserId, userId))
      .orderBy(desc(userInvitation.createdAt));
    return rows.map((r) => ({
      ...mapInvitationSummary(r),
      inviteEmailLastStatus: r.inviteEmailLastStatus ?? null,
    }));
  }

  async updateStatus(
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
  ): Promise<void> {
    await this.db
      .update(userInvitation)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userInvitation.id, id));
  }

  async markOpenedFirstTouch(id: string): Promise<void> {
    const existing = await this.findById(id);
    if (!existing || existing.openedAt) return;
    await this.updateStatus(id, { openedAt: new Date() });
  }
}
