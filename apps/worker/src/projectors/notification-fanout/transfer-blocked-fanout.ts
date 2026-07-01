import { legalEntity, legalEntityMember, payout, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { and, eq, inArray, isNotNull, isNull, or } from "drizzle-orm";
import {
  type Db,
  type TransferBlockedPayload,
  formatReason,
} from "./notification-fanout-helpers.js";

export async function fanoutPayoutTransferBlocked(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  adminPayoutsUrl: string;
  eventId: number;
  payoutId: string;
  payload: TransferBlockedPayload;
}): Promise<void> {
  const { db, emailService, supportContactEmail, adminPayoutsUrl, eventId, payoutId, payload } =
    options;
  if (!payload?.legalEntityId) return;

  const [entityRow] = await db
    .select({ displayName: legalEntity.displayName })
    .from(legalEntity)
    .where(eq(legalEntity.id, payload.legalEntityId))
    .limit(1);
  const entityName = entityRow?.displayName ?? "Unknown Organisation";

  const [payoutRow] = await db
    .select({ netAmount: payout.netAmount, currency: payout.currency })
    .from(payout)
    .where(eq(payout.id, payoutId))
    .limit(1);
  const payoutAmount = payoutRow?.netAmount ?? "0.00";
  const payoutCurrency = payoutRow?.currency ?? "GBP";

  const recipients = await db
    .selectDistinct({
      email: user.email,
      userId: user.id,
      firstName: user.firstName,
    })
    .from(legalEntityMember)
    .innerJoin(user, eq(user.id, legalEntityMember.userId))
    .where(
      and(
        eq(legalEntityMember.legalEntityId, payload.legalEntityId),
        isNull(legalEntityMember.removedAt),
        isNotNull(legalEntityMember.acceptedAt),
        or(
          inArray(legalEntityMember.role, ["owner", "admin", "finance"]),
          eq(legalEntityMember.isPrimaryAdmin, true),
        ),
      ),
    );

  for (const recipient of recipients) {
    await emailService.enqueue({
      template: "payout-transfer-blocked-notice",
      to: recipient.email,
      userId: recipient.userId,
      vars: {
        recipientFirstName: recipient.firstName,
        entityName,
        payoutId,
        payoutAmount,
        payoutCurrency,
        blockReason: formatReason(payload.reason),
        supportContactEmail,
        adminPayoutsUrl,
      },
      category: "transactional",
      idempotencyKey: `payout-transfer-blocked-notice:${eventId}:${recipient.userId}`,
    });
  }
}
