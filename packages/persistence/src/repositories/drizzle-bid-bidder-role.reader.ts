import type { Database } from "@auction/db";
import { bidUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IBidBidderRoleReader } from "../interfaces/bid-bidder-role.reader.js";

export class DrizzleBidBidderRoleReader implements IBidBidderRoleReader {
  constructor(private readonly db: Database) {}

  async findBidderRole(userId: string) {
    const [row] = await this.db
      .select({ role: bidUserProfile.role, staffRole: bidUserProfile.staffRole })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    return row ?? null;
  }
}
