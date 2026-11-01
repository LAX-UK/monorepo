import type { ILegalEntityNotificationRecipientReader } from "@auction/persistence/interfaces";
import type { NotificationDispatcher } from "../notification.dispatcher.js";
import type {
  ConsignmentMessageNotice,
  IConsignmentMessageNotifier,
} from "./consignment-message.ports.js";

export const CONSIGNMENT_MESSAGE_NOTIFICATION = "consignment_message";

const EXCERPT_LENGTH = 140;

/** The opening of the message, or what was sent when it is only files. */
export function noticeExcerpt(notice: Pick<ConsignmentMessageNotice, "body" | "fileCount">) {
  const flat = notice.body.replace(/\s+/g, " ").trim();
  if (flat.length === 0) return notice.fileCount === 1 ? "Sent a file." : "Sent files.";
  return flat.length > EXCERPT_LENGTH ? `${flat.slice(0, EXCERPT_LENGTH - 1)}…` : flat;
}

/**
 * Sends message notices through the dispatcher, which applies each person's mutes, preferences
 * and quiet hours. The account's notice reaches the people who answer: owners and admins, and
 * the member who sent the work (a consignor sees only their own consignments).
 */
export class ConsignmentMessageNotifier implements IConsignmentMessageNotifier {
  constructor(
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly recipients: ILegalEntityNotificationRecipientReader | null,
  ) {}

  async specialistWrote(notice: ConsignmentMessageNotice): Promise<void> {
    const account = notice.subject.account;
    if (!account || !this.recipients) return;
    const [sellers, admins] = await Promise.all([
      this.recipients.listUserIdsForAudience(account.id, "seller").catch((): string[] => []),
      this.recipients.listUserIdsForAudience(account.id, "admin").catch((): string[] => []),
    ]);
    const answerers = new Set(admins);
    const sender = notice.subject.submittedByUserId;
    if (sender && sellers.includes(sender)) answerers.add(sender);
    for (const userId of answerers) {
      await this.dispatcher
        .dispatch(userId, {
          type: CONSIGNMENT_MESSAGE_NOTIFICATION,
          title: `Reply from ${notice.authorName}`,
          message: `“${notice.subject.title}”: ${noticeExcerpt(notice)}`,
          submissionId: notice.subject.submissionId,
          legalEntityId: account.id,
        })
        .catch(() => undefined);
    }
  }

  async clientWrote(notice: ConsignmentMessageNotice): Promise<void> {
    const specialist = notice.subject.specialist;
    if (!specialist) return;
    const from = notice.subject.account
      ? `${notice.authorName} (${notice.subject.account.name})`
      : notice.authorName;
    await this.dispatcher
      .dispatch(specialist.userId, {
        type: CONSIGNMENT_MESSAGE_NOTIFICATION,
        title: `${from} wrote about “${notice.subject.title}”`,
        message: noticeExcerpt(notice),
        submissionId: notice.subject.submissionId,
        // Staff answer in Bid admin, outside any client account.
        legalEntityId: null,
        meta: { audience: "staff" },
      })
      .catch(() => undefined);
  }
}
