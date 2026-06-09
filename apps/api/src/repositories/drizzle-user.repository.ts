import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { IUserRepository } from "../services/interfaces/repositories.js";

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
    ] as const;
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.role, "staff"), inArray(user.staffRole, [...staffRoles])));
    return rows.map((r) => r.id);
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
}
