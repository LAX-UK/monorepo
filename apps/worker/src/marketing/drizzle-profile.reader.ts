import type { Database } from "@auction/db";
import { bidIdentityDirectory, bidUserProfile } from "@auction/db/schema";
import type { IMarketingProfileReader } from "@auction/marketing-events";
import { eq, sql } from "drizzle-orm";

export class DrizzleProfileMarketingReader implements IMarketingProfileReader {
  constructor(private readonly db: Database) {}

  async getProfile(userId: string) {
    const [row] = await this.db
      .select({
        email: bidIdentityDirectory.email,
        name: bidIdentityDirectory.name,
        mobile: sql<
          string | null
        >`coalesce(${bidUserProfile.mobile}, ${bidIdentityDirectory.phone})`,
      })
      .from(bidIdentityDirectory)
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    if (!row) return null;
    return {
      email: row.email,
      name: row.name,
      ...(row.mobile ? { phone: row.mobile } : {}),
    };
  }
}
