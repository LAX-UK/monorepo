import type { Database } from "@auction/db";
import {
  bidIdentityDirectory,
  bidUserProfile,
  legalEntity,
  legalEntityMember,
  payout,
} from "@auction/db/schema";
import { and, eq, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";
import type { IPayoutTransferFailedNotifyReader } from "../interfaces/payout-transfer-failed-notify.reader.js";

export class DrizzlePayoutTransferFailedNotifyReader implements IPayoutTransferFailedNotifyReader {
  constructor(private readonly db: Database) {}

  async getTransferFailedContext(
    legalEntityId: string,
    payoutId: string,
    fallbackAmountCents: number,
    fallbackCurrency: string,
  ) {
    const [entityRow] = await this.db
      .select({ displayName: legalEntity.displayName, kind: legalEntity.kind })
      .from(legalEntity)
      .where(eq(legalEntity.id, legalEntityId))
      .limit(1);

    const [payoutRow] = await this.db
      .select({ netAmount: payout.netAmount, currency: payout.currency })
      .from(payout)
      .where(eq(payout.id, payoutId))
      .limit(1);

    const financeMembers = await this.db
      .selectDistinct({
        email: bidIdentityDirectory.email,
        userId: bidIdentityDirectory.subjectId,
        firstName: sql<
          string | null
        >`coalesce(${bidUserProfile.firstName}, ${bidIdentityDirectory.name})`,
      })
      .from(legalEntityMember)
      .innerJoin(bidIdentityDirectory, eq(bidIdentityDirectory.subjectId, legalEntityMember.userId))
      .leftJoin(bidUserProfile, eq(bidUserProfile.userId, bidIdentityDirectory.subjectId))
      .where(
        and(
          eq(legalEntityMember.legalEntityId, legalEntityId),
          isNull(legalEntityMember.removedAt),
          isNotNull(legalEntityMember.acceptedAt),
          or(
            inArray(legalEntityMember.role, ["owner", "admin"]),
            eq(legalEntityMember.isPrimaryAdmin, true),
          ),
        ),
      );

    return {
      entityName: entityRow?.displayName ?? "Unknown Organisation",
      entityKind: entityRow?.kind ?? null,
      payoutAmount: payoutRow?.netAmount ?? (fallbackAmountCents / 100).toFixed(2),
      payoutCurrency: payoutRow?.currency ?? fallbackCurrency ?? "GBP",
      financeMembers,
    };
  }
}
