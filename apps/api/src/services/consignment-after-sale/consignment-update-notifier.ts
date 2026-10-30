import type {
  ILegalEntityNotificationRecipientReader,
  LegalEntityNotificationAudience,
} from "@auction/persistence/interfaces";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

export type ConsignmentUpdate = {
  submissionId: string;
  title: string;
  message: string;
};

/** Who hears about an update: an account's members for an audience. */
export type ConsignmentUpdateAudience = {
  legalEntityId: string;
  audience: LegalEntityNotificationAudience;
};

/** Tells the people behind one or more accounts about a change to a consignment. */
export interface IConsignmentUpdateNotifier {
  notify(to: readonly ConsignmentUpdateAudience[], update: ConsignmentUpdate): Promise<void>;
}

/** Tells one staff member (the specialist on a submission) about a change to it. */
export interface IStaffConsignmentNotifier {
  notifyStaff(userId: string, update: ConsignmentUpdate): Promise<void>;
}

/**
 * Sends a consignment update to every member of the given audiences, once each even when they
 * belong to several. Delivery is best effort: a failed notification never undoes the change it
 * reports.
 */
export class ConsignmentUpdateNotifier
  implements IConsignmentUpdateNotifier, IStaffConsignmentNotifier
{
  constructor(
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly recipients: ILegalEntityNotificationRecipientReader | null,
  ) {}

  async notifyStaff(userId: string, update: ConsignmentUpdate): Promise<void> {
    // Staff links open the submission in Bid admin rather than the seller's page.
    await this.dispatcher
      .dispatch(userId, {
        type: "consignment_update",
        title: update.title,
        message: update.message,
        submissionId: update.submissionId,
        // Staff work happens in Bid admin, outside any client account.
        legalEntityId: null,
        meta: { audience: "staff" },
      })
      .catch(() => undefined);
  }

  async notify(to: readonly ConsignmentUpdateAudience[], update: ConsignmentUpdate): Promise<void> {
    const reader = this.recipients;
    if (!reader) return;
    const lists = await Promise.all(
      to.map((target) =>
        reader.listUserIdsForAudience(target.legalEntityId, target.audience).catch(() => []),
      ),
    );
    // Each person once, about the first account in `to` they were reached through.
    const accountOf = new Map<string, string>();
    lists.forEach((userIds, i) => {
      const target = to[i];
      if (!target) return;
      for (const userId of userIds) {
        if (!accountOf.has(userId)) accountOf.set(userId, target.legalEntityId);
      }
    });
    for (const [userId, legalEntityId] of accountOf) {
      await this.dispatcher
        .dispatch(userId, {
          type: "consignment_update",
          title: update.title,
          message: update.message,
          submissionId: update.submissionId,
          legalEntityId,
        })
        .catch(() => undefined);
    }
  }
}
