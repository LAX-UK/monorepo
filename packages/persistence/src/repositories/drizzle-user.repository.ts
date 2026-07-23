import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { DbTransaction } from "../interfaces/artist-delete.repository.js";
import type { IUserRepository } from "../interfaces/user.repository.js";

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const rows = await this.db.select().from(user).where(eq(user.id, id)).limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      staffRole: row.staffRole ?? null,
      image: row.image ?? null,
      hasSeenActingContextTooltip: row.hasSeenActingContextTooltip ?? false,
    };
  }

  async findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const rows = await this.db
      .select()
      .from(user)
      .where(sql`lower(${user.email}) = ${normalized}`)
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      staffRole: row.staffRole ?? null,
      image: row.image ?? null,
      hasSeenActingContextTooltip: row.hasSeenActingContextTooltip ?? false,
    };
  }

  async findVerifiedIdByEmail(email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized) return null;
    const [row] = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.emailVerified, true), sql`lower(${user.email}) = ${normalized}`))
      .limit(1);
    return row?.id ?? null;
  }

  async listIdsByRole(role: string): Promise<string[]> {
    const rows = await this.db.select({ id: user.id }).from(user).where(eq(user.role, role));
    return rows.map((r) => r.id);
  }

  async listStaffIdsForSubmissionNotifications(): Promise<string[]> {
    const staffRoles = [
      "super_admin",
      "auction_manager",
      "catalogue_manager",
      "specialist",
      "operations",
    ] as const;
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "staff"), inArray(user.staffRole, [...staffRoles])));
    return rows.map((r) => r.id);
  }

  async listStaffEmails(): Promise<string[]> {
    const rows = await this.db
      .select({ email: user.email })
      .from(user)
      .where(eq(user.role, "staff"));
    return [...new Set(rows.map((r) => r.email).filter((e): e is string => Boolean(e?.trim())))];
  }

  async listPublicProfiles(params: { limit: number; offset: number }) {
    const rows = await this.db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(user)
      .orderBy(asc(user.name))
      .limit(params.limit)
      .offset(params.offset);
    return rows;
  }

  async updateActingContextTooltipSeen(userId: string, seen: boolean): Promise<void> {
    await this.db
      .update(user)
      .set({ hasSeenActingContextTooltip: seen })
      .where(eq(user.id, userId));
  }

  async markDeletionRequested(userId: string, tx: DbTransaction): Promise<void> {
    await tx
      .update(user)
      .set({ deletionRequestedAt: new Date(), updatedAt: new Date() })
      .where(eq(user.id, userId));
  }
}
