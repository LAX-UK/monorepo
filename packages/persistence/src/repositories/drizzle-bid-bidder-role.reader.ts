import type { Database } from "@auction/db";
import { bidUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { BidderRoleRow, IBidBidderRoleReader } from "../interfaces/bid-bidder-role.reader.js";
import { DrizzleStaffRoleAssignmentReader } from "./drizzle-staff-roster.js";

export class DrizzleBidBidderRoleReader implements IBidBidderRoleReader {
  private readonly assignments: DrizzleStaffRoleAssignmentReader;

  constructor(private readonly db: Database) {
    this.assignments = new DrizzleStaffRoleAssignmentReader(db);
  }

  async findBidderRole(userId: string): Promise<BidderRoleRow | null> {
    const [row] = await this.db
      .select({ role: bidUserProfile.role })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    if (!row) return null;
    const staffRoles =
      row.role === "staff" ? await this.assignments.listActiveRoles(userId, new Date()) : [];
    return { role: row.role, staffRoles };
  }
}
