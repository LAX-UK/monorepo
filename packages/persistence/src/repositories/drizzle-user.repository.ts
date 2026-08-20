import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type { IUserRepository } from "../interfaces/user.repository.js";
import {
  activeIdentitySubject,
  normalizedIdentityEmailEquals,
} from "../lib/bid-identity-directory-query.js";

export class DrizzleUserRepository implements IUserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const rows = await this.db
      .select({
        id: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
        role: bidUserProfile.role,
        staffRole: bidUserProfile.staffRole,
        image: bidIdentityDirectory.image,
        hasSeenActingContextTooltip: bidUserProfile.hasSeenActingContextTooltip,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role ?? "client",
      staffRole: row.staffRole ?? null,
      image: row.image ?? null,
      hasSeenActingContextTooltip: row.hasSeenActingContextTooltip ?? false,
    };
  }

  async findByEmail(email: string) {
    const rows = await this.db
      .select({
        id: bidIdentityDirectory.subjectId,
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
        role: bidUserProfile.role,
        staffRole: bidUserProfile.staffRole,
        image: bidIdentityDirectory.image,
        hasSeenActingContextTooltip: bidUserProfile.hasSeenActingContextTooltip,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(
        and(
          normalizedIdentityEmailEquals(bidIdentityDirectory.email, email),
          activeIdentitySubject(),
        ),
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role ?? "client",
      staffRole: row.staffRole ?? null,
      image: row.image ?? null,
      hasSeenActingContextTooltip: row.hasSeenActingContextTooltip ?? false,
    };
  }

  async findVerifiedIdByEmail(email: string): Promise<string | null> {
    if (!email.trim()) return null;
    const [row] = await this.db
      .select({ id: bidIdentityDirectory.subjectId })
      .from(bidIdentityDirectory)
      .where(
        and(
          eq(bidIdentityDirectory.emailVerified, true),
          normalizedIdentityEmailEquals(bidIdentityDirectory.email, email),
          activeIdentitySubject(),
        ),
      )
      .limit(1);
    return row?.id ?? null;
  }

  async listIdsByRole(role: string): Promise<string[]> {
    const rows = await this.db
      .select({ id: bidUserProfile.userId })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.role, role));
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
      .select({ id: bidUserProfile.userId })
      .from(bidUserProfile)
      .where(
        and(eq(bidUserProfile.role, "staff"), inArray(bidUserProfile.staffRole, [...staffRoles])),
      );
    return rows.map((r) => r.id);
  }

  async listStaffEmails(): Promise<string[]> {
    const rows = await this.db
      .select({ email: bidIdentityDirectory.email })
      .from(bidIdentityDirectory)
      .innerJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(and(eq(bidUserProfile.role, "staff"), activeIdentitySubject()));
    return [...new Set(rows.map((r) => r.email).filter((e): e is string => Boolean(e?.trim())))];
  }

  async listPublicProfiles(params: { limit: number; offset: number }) {
    const rows = await this.db
      .select({
        id: bidIdentityDirectory.subjectId,
        name: bidIdentityDirectory.name,
        image: bidIdentityDirectory.image,
      })
      .from(bidIdentityDirectory)
      .where(activeIdentitySubject())
      .orderBy(asc(bidIdentityDirectory.name))
      .limit(params.limit)
      .offset(params.offset);
    return rows;
  }

  async updateActingContextTooltipSeen(userId: string, seen: boolean): Promise<void> {
    await writeBidUserProfile(this.db, userId, { hasSeenActingContextTooltip: seen });
  }
}
