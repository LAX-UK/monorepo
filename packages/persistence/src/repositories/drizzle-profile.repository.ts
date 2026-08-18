import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { eq, sql } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type {
  IProfileReader,
  IProfileWriter,
  ProfileMeRow,
  ProfileUpdateInput,
} from "../interfaces/profile.repository.js";

export class DrizzleProfileRepository implements IProfileReader, IProfileWriter {
  constructor(private readonly db: Database) {}

  async getProfile(userId: string): Promise<ProfileMeRow | null> {
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        mobile: sql<string | null>`coalesce(${bidUserProfile.mobile}, ${user.mobile})`,
        mobileCountry: sql<
          string | null
        >`coalesce(${bidUserProfile.mobileCountry}, ${user.mobileCountry})`,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        image: user.image,
        role: sql<string>`coalesce(${bidUserProfile.role}, ${user.role})`,
        staffRole: sql<
          (typeof bidUserProfile.staffRole.enumValues)[number] | null
        >`coalesce(${bidUserProfile.staffRole}, ${user.staffRole})`,
        emailVerified: user.emailVerified,
        emailStatus: sql<string>`coalesce(${bidUserProfile.emailStatus}, ${user.emailStatus})`,
        emailStatusChangedAt: sql<Date | null>`coalesce(
          ${bidUserProfile.emailStatusChangedAt},
          ${user.emailStatusChangedAt}
        )`,
        pendingNewEmail: user.pendingNewEmail,
        hasSeenActingContextTooltip: sql<boolean>`coalesce(
          ${bidUserProfile.hasSeenActingContextTooltip},
          ${user.hasSeenActingContextTooltip}
        )`,
        kycStatus: sql<
          (typeof bidUserProfile.kycStatus.enumValues)[number]
        >`coalesce(${bidUserProfile.kycStatus}, ${user.kycStatus})`,
        signupPersona: sql<
          string | null
        >`coalesce(${bidUserProfile.signupPersona}, ${user.signupPersona})`,
        deletionRequestedAt: user.deletionRequestedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        suspendedAt: sql<Date | null>`coalesce(${bidUserProfile.suspendedAt}, ${user.suspendedAt})`,
      })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;
    const persona =
      row.signupPersona === "individual" || row.signupPersona === "organisation"
        ? row.signupPersona
        : null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      mobile: row.mobile ?? null,
      mobileCountry: row.mobileCountry ?? null,
      phoneNumber: row.phoneNumber ?? null,
      phoneNumberVerified: row.phoneNumberVerified ?? false,
      image: row.image ?? null,
      role: row.role,
      staffRole: row.staffRole ?? null,
      emailVerified: row.emailVerified,
      emailStatus: row.emailStatus as "ok" | "bounced" | "complained",
      emailStatusChangedAt: row.emailStatusChangedAt,
      pendingNewEmail: row.pendingNewEmail ?? null,
      hasSeenActingContextTooltip: row.hasSeenActingContextTooltip ?? false,
      kycStatus: row.kycStatus,
      signupPersona: persona,
      deletionRequestedAt: row.deletionRequestedAt ?? null,
      twoFactorEnabled: row.twoFactorEnabled ?? false,
      suspended: row.suspendedAt != null,
    };
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<void> {
    if (input.mobile !== undefined || input.mobileCountry !== undefined) {
      await this.db.transaction(async (tx) => {
        await writeBidUserProfile(tx, userId, {
          ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
          ...(input.mobileCountry !== undefined ? { mobileCountry: input.mobileCountry } : {}),
        });
      });
    }
  }
}
