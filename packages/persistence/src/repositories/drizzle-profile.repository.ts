import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
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
        mobile: bidUserProfile.mobile,
        mobileCountry: bidUserProfile.mobileCountry,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        image: user.image,
        role: bidUserProfile.role,
        staffRole: bidUserProfile.staffRole,
        emailVerified: user.emailVerified,
        emailStatus: bidUserProfile.emailStatus,
        emailStatusChangedAt: bidUserProfile.emailStatusChangedAt,
        pendingNewEmail: user.pendingNewEmail,
        hasSeenActingContextTooltip: bidUserProfile.hasSeenActingContextTooltip,
        kycStatus: bidUserProfile.kycStatus,
        signupPersona: bidUserProfile.signupPersona,
        deletionRequestedAt: user.deletionRequestedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        suspendedAt: bidUserProfile.suspendedAt,
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
      role: row.role ?? "client",
      staffRole: row.staffRole ?? null,
      emailVerified: row.emailVerified,
      emailStatus: (row.emailStatus ?? "ok") as "ok" | "bounced" | "complained",
      emailStatusChangedAt: row.emailStatusChangedAt,
      pendingNewEmail: row.pendingNewEmail ?? null,
      hasSeenActingContextTooltip: row.hasSeenActingContextTooltip ?? false,
      kycStatus: row.kycStatus ?? "unverified",
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
