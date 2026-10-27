import type { Database } from "@auction/db";
import { bidUserProfile } from "@auction/db/schema";
import { eq } from "drizzle-orm";
import { writeBidUserProfile } from "../bid-user-profile-sync.js";
import type { IRememberedAccountStore } from "../interfaces/remembered-account.store.js";

export class DrizzleRememberedAccountStore implements IRememberedAccountStore {
  constructor(private readonly db: Database) {}

  async findRemembered(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ legalEntityId: bidUserProfile.lastActingLegalEntityId })
      .from(bidUserProfile)
      .where(eq(bidUserProfile.userId, userId))
      .limit(1);
    return row?.legalEntityId ?? null;
  }

  async remember(userId: string, legalEntityId: string): Promise<void> {
    await writeBidUserProfile(this.db, userId, { lastActingLegalEntityId: legalEntityId });
  }
}
