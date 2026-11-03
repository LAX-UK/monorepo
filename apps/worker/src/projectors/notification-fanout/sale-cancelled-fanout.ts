import { saleCancelledConsequence } from "@auction/branding";
import type { IEmailService } from "@auction/email";
import type {
  CreateNotificationRow,
  INotificationWriteRepository,
} from "@auction/persistence/interfaces";
import type { INotificationFanoutReader } from "../../interfaces/notification-fanout.reader.js";
import type { SaleCancelledPayload } from "./notification-fanout-helpers.js";
import {
  type ConsignorMember,
  type SaleCancelledRecipient,
  planSaleCancelledRecipients,
} from "./sale-cancelled-recipients.js";

/** The in-app notice for one person; its wording matches the email. */
export function saleCancelledNotice(
  recipient: SaleCancelledRecipient,
  saleTitle: string,
): CreateNotificationRow {
  return {
    userId: recipient.userId,
    type: "sale_cancelled",
    legalEntityId: recipient.legalEntityId,
    title: "Sale cancelled",
    message: `The sale "${saleTitle}" has been cancelled. ${saleCancelledConsequence(recipient.audience)}`,
  };
}

/**
 * Tells everyone in a cancelled sale once: bidders, consignors, people who watched its lots and
 * telephone clients, by email and in the app. Cancelling a single lot tells the people in that
 * lot; this replaces one notice per lot with one per person.
 */
export async function fanoutSaleCancelled(options: {
  notificationFanoutReader: INotificationFanoutReader;
  notificationWriteRepo: INotificationWriteRepository;
  emailService: IEmailService;
  supportContactEmail: string;
  eventId: number;
  saleId: string;
  payload: SaleCancelledPayload;
}) {
  const { notificationFanoutReader: reader, payload, saleId, eventId } = options;
  const lotIds = payload?.cancelledLotIds ?? [];
  if (lotIds.length === 0) return;
  const [saleTitle, people] = await Promise.all([
    reader.getSaleTitle(saleId),
    reader.listSaleCancelledPeople(lotIds, saleId),
  ]);
  if (!saleTitle) return;

  const consignorMembers: ConsignorMember[] = [];
  for (const legalEntityId of people.consignorEntityIds) {
    for (const member of await reader.listEntityRecipients(legalEntityId)) {
      consignorMembers.push({ userId: member.userId, legalEntityId });
    }
  }

  const recipients = planSaleCancelledRecipients(people, consignorMembers);
  for (const recipient of recipients) {
    const person = await reader.getUserForProxyNotice(recipient.userId);
    if (!person?.email) continue;
    await options.emailService.enqueue({
      template: "sale-cancelled-notice",
      to: person.email,
      userId: recipient.userId,
      vars: {
        userName: person.firstName ?? person.name,
        saleTitle,
        audience: recipient.audience,
        supportContactEmail: options.supportContactEmail,
      },
      category: "transactional",
      idempotencyKey: `sale-cancelled:${eventId}:${recipient.userId}`,
    });
  }
  if (recipients.length > 0) {
    await options.notificationWriteRepo.createMany(
      recipients.map((r) => saleCancelledNotice(r, saleTitle)),
    );
  }
}
