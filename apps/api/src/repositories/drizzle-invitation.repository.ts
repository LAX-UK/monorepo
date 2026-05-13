import type { Database } from "@auction/db";
import { userInvitation } from "@auction/db/schema";
import type { UserRole, UserStaffRole } from "@auction/types";
import { and, desc, eq } from "drizzle-orm";
import type {
  IUserInvitationRepository,
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
    acceptedAt: r.acceptedAt ?? null,
    acceptedUserId: r.acceptedUserId ?? null,
    createdByUserId: r.createdByUserId,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapSummary(r: {
  id: string;
  email: string;
  targetRole: string;
  targetStaffRole: string | null;
  status: InvitationRow["status"];
  expiresAt: Date;
  acceptedAt: Date | null;
  acceptedUserId: string | null;
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
    acceptedAt: r.acceptedAt ?? null,
    acceptedUserId: r.acceptedUserId ?? null,
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
      acceptedAt: row.acceptedAt,
      acceptedUserId: row.acceptedUserId,
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

  async listPendingCreatedBy(userId: string): Promise<InvitationSummary[]> {
    const rows = await this.db
      .select({
        id: userInvitation.id,
        email: userInvitation.email,
        targetRole: userInvitation.targetRole,
        targetStaffRole: userInvitation.targetStaffRole,
        status: userInvitation.status,
        expiresAt: userInvitation.expiresAt,
        acceptedAt: userInvitation.acceptedAt,
        acceptedUserId: userInvitation.acceptedUserId,
        createdByUserId: userInvitation.createdByUserId,
        createdAt: userInvitation.createdAt,
        updatedAt: userInvitation.updatedAt,
      })
      .from(userInvitation)
      .where(and(eq(userInvitation.createdByUserId, userId), eq(userInvitation.status, "pending")))
      .orderBy(desc(userInvitation.createdAt));
    return rows.map(mapSummary);
  }

  async updateStatus(
    id: string,
    patch: Partial<
      Pick<InvitationRow, "status" | "acceptedAt" | "acceptedUserId" | "tokenHash" | "expiresAt">
    >,
  ): Promise<void> {
    await this.db
      .update(userInvitation)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(userInvitation.id, id));
  }
}
