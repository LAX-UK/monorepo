import type { Database } from "@auction/db";
import { bidUserProfile, user } from "@auction/db/schema";
import type { IMarketingProfileReader } from "@auction/marketing-events";
import { eq, sql } from "drizzle-orm";

export class DrizzleProfileMarketingReader implements IMarketingProfileReader {
  constructor(private readonly db: Database) {}

  async getProfile(userId: string) {
    const [row] = await this.db
      .select({
        email: user.email,
        name: user.name,
        mobile: sql<string | null>`coalesce(${bidUserProfile.mobile}, ${user.phoneNumber})`,
      })
      .from(user)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, user.id))
      .where(eq(user.id, userId))
      .limit(1);
    if (!row) return null;
    return {
      email: row.email,
      name: row.name,
      ...(row.mobile ? { phone: row.mobile } : {}),
    };
  }
}
