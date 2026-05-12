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
    };
  }

  async updateProfile(userId: string, input: ProfileUpdateInput): Promise<void> {
    const set: { name?: string; image?: string | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) set.name = input.name;
    if (input.image !== undefined) set.image = input.image;
    await this.db.update(user).set(set).where(eq(user.id, userId));
  }
}
