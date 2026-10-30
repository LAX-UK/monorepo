import type {
  ILegalEntityNotificationRecipientReader,
  LegalEntityNotificationAudience,
} from "@auction/persistence/interfaces";
import type { NotificationPayload } from "../interfaces/notification-channel.js";
import type { IMemberLeftNotifier } from "../member-management.service.js";
import type { NotificationDispatcher } from "../notification.dispatcher.js";

/** Tells the people who handle an organisation's money that its payout bank account changed. */
export interface IPayoutBankChangeNotifier {
  bankChanged(input: {
    legalEntityId: string;
    organisationName: string;
    bankLast4: string | null;
  }): Promise<void>;
}

/** Looks up a person's name for the words of a notice. */
export interface INoticePersonNames {
  nameOf(userId: string): Promise<string | null>;
}

/**
 * In-app notices to the people who run an organisation. Delivery is best effort: a notice that
 * fails never undoes the change it reports, which is recorded in Activity either way.
 */
export class OrganisationTeamNotifier implements IMemberLeftNotifier, IPayoutBankChangeNotifier {
  constructor(
    private readonly deps: {
      dispatcher: Pick<NotificationDispatcher, "dispatch">;
      recipients: ILegalEntityNotificationRecipientReader;
      people: INoticePersonNames;
    },
  ) {}

  async memberLeft(input: { legalEntityId: string; memberUserId: string }): Promise<void> {
    const name =
      (await this.deps.people.nameOf(input.memberUserId).catch(() => null)) ?? "A member";
    await this.send(input.legalEntityId, "admin", {
      type: "organisation_member_left",
      title: `${name} left the organisation`,
      message: "Their automatic bids for the organisation have stopped. Bids already placed stand.",
    });
  }

  async bankChanged(input: {
    legalEntityId: string;
    organisationName: string;
    bankLast4: string | null;
  }): Promise<void> {
    const account = input.bankLast4 ? ` to the account ending ${input.bankLast4}` : "";
    await this.send(input.legalEntityId, "finance", {
      type: "payout_bank_changed",
      title: `The payout bank account for ${input.organisationName} changed`,
      message: `Payouts now go${account}. If nobody at ${input.organisationName} made this change, contact us straight away.`,
      meta: { organisationName: input.organisationName, bankLast4: input.bankLast4 },
    });
  }

  private async send(
    legalEntityId: string,
    audience: LegalEntityNotificationAudience,
    notice: Omit<NotificationPayload, "legalEntityId">,
  ) {
    const userIds = await this.deps.recipients
      .listUserIdsForAudience(legalEntityId, audience)
      .catch(() => []);
    for (const userId of new Set(userIds)) {
      // The notice belongs to the organisation, so it shows its tag and opens in its account.
      await this.deps.dispatcher
        .dispatch(userId, { ...notice, legalEntityId })
        .catch(() => undefined);
    }
  }
}
