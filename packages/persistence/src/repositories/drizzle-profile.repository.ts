import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
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
        mobile: user.mobile,
        mobileCountry: user.mobileCountry,
        phoneNumber: user.phoneNumber,
        phoneNumberVerified: user.phoneNumberVerified,
        image: user.image,
        role: user.role,
        staffRole: user.staffRole,
        emailVerified: user.emailVerified,
        emailStatus: user.emailStatus,
        emailStatusChangedAt: user.emailStatusChangedAt,
        pendingNewEmail: user.pendingNewEmail,
        hasSeenActingContextTooltip: user.hasSeenActingContextTooltip,
        kycStatus: user.kycStatus,
        signupPersona: user.signupPersona,
        categoryInterestsOnboardingCompletedAt: user.categoryInterestsOnboardingCompletedAt,
        deletionRequestedAt: user.deletionRequestedAt,
        twoFactorEnabled: user.twoFactorEnabled,
        suspendedAt: user.suspendedAt,
      })
      .from(user)
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
      categoryInterestsOnboardingCompletedAt: row.categoryInterestsOnboardingCompletedAt ?? null,
      deletionRequestedAt: row.deletionRequestedAt ?? null,
      twoFactorEnabled: row.twoFactorEnabled ?? false,
      suspended: row.suspendedAt != null,
    };
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<void> {
    await this.db
      .update(user)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.image !== undefined ? { image: input.image } : {}),
        ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
        ...(input.mobileCountry !== undefined ? { mobileCountry: input.mobileCountry } : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }
}
