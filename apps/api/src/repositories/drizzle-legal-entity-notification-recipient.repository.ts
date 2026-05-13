import type { Database } from "@auction/db";
import { legalEntityMember } from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import type {
  ILegalEntityNotificationRecipientReader,
  LegalEntityNotificationAudience,
} from "../services/interfaces/legal-entity-notification-recipients.js";
import { legalEntityNotificationAudienceRoles } from "../services/interfaces/legal-entity-notification-recipients.js";

export class DrizzleLegalEntityNotificationRecipientRepository
  implements ILegalEntityNotificationRecipientReader
{
  constructor(private readonly db: Database) {}

  async listUserIdsForAudience(
    legalEntityId: string,
    audience: LegalEntityNotificationAudience,
  ): Promise<string[]> {
    const roles = [...legalEntityNotificationAudienceRoles[audience]];
    const rows = await this.db
      .selectDistinct({ userId: legalEntityMember.userId })
      .from(legalEntityMember)
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          inArray(legalEntityMember.role, roles),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
        ),
      );

    return rows.map((row) => row.userId);
  }
}
