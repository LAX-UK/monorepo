import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type { IUserRepository } from "../interfaces/user.repository.js";

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const rows = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: sql<string>`coalesce(${bidUserProfile.role}, ${user.role})`,
        staffRole: sql<
          (typeof bidUserProfile.staffRole.enumValues)[number] | null
        >`coalesce(${bidUserProfile.staffRole}, ${user.staffRole})`,
        image: user.image,
        hasSeenActingContextTooltip: sql<boolean>`coalesce(
          ${bidUserProfile.hasSeenActingContextTooltip},
          ${user.hasSeenActingContextTooltip}
        )`,
      })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(eq(user.id, id))
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

  async findByEmail(email: string) {
    const normalized = email.trim().toLowerCase();
    const rows = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        role: sql<string>`coalesce(${bidUserProfile.role}, ${user.role})`,
        staffRole: sql<
          (typeof bidUserProfile.staffRole.enumValues)[number] | null
        >`coalesce(${bidUserProfile.staffRole}, ${user.staffRole})`,
        image: user.image,
        hasSeenActingContextTooltip: sql<boolean>`coalesce(
          ${bidUserProfile.hasSeenActingContextTooltip},
          ${user.hasSeenActingContextTooltip}
        )`,
      })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
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
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(sql`coalesce(${bidUserProfile.role}, ${user.role}) = ${role}`);
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
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(
        and(
          sql`coalesce(${bidUserProfile.role}, ${user.role}) = 'staff'`,
          inArray(sql`coalesce(${bidUserProfile.staffRole}, ${user.staffRole})`, [...staffRoles]),
        ),
      );
    return rows.map((r) => r.id);
  }

  async listStaffEmails(): Promise<string[]> {
    const rows = await this.db
      .select({ email: user.email })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(sql`coalesce(${bidUserProfile.role}, ${user.role}) = 'staff'`);
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
    await writeBidUserProfile(this.db, userId, { hasSeenActingContextTooltip: seen });
  }
}
