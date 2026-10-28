import type { Database } from "@auction/db";
import { legalEntityMember } from "@auction/db/schema";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import type { IMemberWelcomeStore } from "../interfaces/member-welcome.store.js";

export class DrizzleMemberWelcomeStore implements IMemberWelcomeStore {
  constructor(private readonly db: Database) {}

  async dismiss(userId: string, legalEntityId: string, at: Date): Promise<boolean> {
    const rows = await this.db
      .update(legalEntityMember)
      .set({ welcomeDismissedAt: at })
      .where(
        and(
          eq(legalEntityMember.userId, userId),
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      )
      .returning({ id: legalEntityMember.id });
    return rows.length > 0;
  }
}
