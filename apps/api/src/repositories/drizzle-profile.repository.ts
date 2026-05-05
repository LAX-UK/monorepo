import type { Database } from "@auction/db";
import { user } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type {
  IProfileReader,
  IProfileWriter,
  ProfileUpdateInput,
} from "../services/interfaces/profile.js";

export class DrizzleProfileRepository implements IProfileReader, IProfileWriter {
  constructor(private readonly db: Database) {}

  async getProfile(userId: string) {
    const [row] = await this.db
      .select({
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        emailVerified: user.emailVerified,
        emailStatus: user.emailStatus,
        emailStatusChangedAt: user.emailStatusChangedAt,
      })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      image: row.image ?? null,
      role: row.role,
      emailVerified: row.emailVerified,
      emailStatus: row.emailStatus as "ok" | "bounced" | "complained",
      emailStatusChangedAt: row.emailStatusChangedAt,
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
