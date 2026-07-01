import { lot, user } from "@auction/db/schema";
import type { IEmailService } from "@auction/email";
import { eq } from "drizzle-orm";
import {
  type Db,
  type LotVoidedPayload,
  listEntityRecipients,
} from "./notification-fanout-helpers.js";

export async function fanoutLotVoided(options: {
  db: Db;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  lotId: string;
  payload: LotVoidedPayload;
}) {
  const lotId = options.payload.lotId ?? options.lotId;
  const [lotRow] = await options.db
    .select({
      title: lot.title,
      winnerId: lot.winnerId,
      sellerLegalEntityId: lot.sellerLegalEntityId,
    })
    .from(lot)
    .where(eq(lot.id, lotId))
    .limit(1);
  if (!lotRow) return;
  const lotTitle = lotRow.title ?? "Unknown Lot";
  if (lotRow.sellerLegalEntityId) {
    const recipients = await listEntityRecipients(options.db, lotRow.sellerLegalEntityId);
    for (const recipient of recipients) {
      await options.emailService.enqueue({
        template: "lot-voided-notice",
        to: recipient.email,
        userId: recipient.userId,
        vars: {
          recipientFirstName: recipient.firstName,
          lotTitle,
          reason: options.payload.reason,
          supportContactEmail: options.supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `lot-voided-notice:${options.eventId}:seller:${recipient.userId}`,
      });
    }
  }
  if (lotRow.winnerId) {
    const [winner] = await options.db
      .select({ email: user.email, firstName: user.firstName })
      .from(user)
      .where(eq(user.id, lotRow.winnerId))
      .limit(1);
    if (winner?.email) {
      await options.emailService.enqueue({
        template: "lot-voided-notice",
        to: winner.email,
        userId: lotRow.winnerId,
        vars: {
          recipientFirstName: winner.firstName,
          lotTitle,
          reason: options.payload.reason,
          supportContactEmail: options.supportContactEmail,
        },
        category: "transactional",
        idempotencyKey: `lot-voided-notice:${options.eventId}:winner:${lotRow.winnerId}`,
      });
    }
  }
}
