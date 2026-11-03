import type { Database } from "@auction/db";
import { bidIdentityDirectory } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import type { IEmailAddressLookup } from "../interfaces/email-provider-suppression.js";

export class DrizzleEmailAddressLookup implements IEmailAddressLookup {
  constructor(private readonly db: Database) {}

  async findEmail(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ email: bidIdentityDirectory.email })
      .from(bidIdentityDirectory)
      .where(eq(bidIdentityDirectory.subjectId, userId))
      .limit(1);
    return row?.email ?? null;
  }
}
