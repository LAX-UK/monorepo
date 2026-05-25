import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  IProfileReader,
  IProfileWriter,
  ProfileMeRow,
  ProfileUpdateInput,
} from "../services/interfaces/profile.js";

export class DrizzleProfileRepository implements IProfileReader, IProfileWriter {
  constructor(private readonly db: Database) {}

  async getProfile(userId: string): Promise<ProfileMeRow | null> {
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
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
    await this.db
      .update(user)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.image !== undefined ? { image: input.image } : {}),
        updatedAt: new Date(),
      })
      .where(eq(user.id, userId));
  }
}
