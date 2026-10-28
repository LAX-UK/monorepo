import { BUSINESS_TIME_ZONE } from "@auction/domain";
import type { IEmailService } from "@auction/email";
import type {
  IStaffNoticeRecipientReader,
  StaffNoticeRecipient,
} from "@auction/persistence/interfaces";
import { laxStaffRoleOption } from "@auction/types";
import type { NotificationPayload } from "../services/interfaces/notification-channel.js";
import type { NotificationDispatcher } from "../services/notification.dispatcher.js";
import type {
  EndedStaffRole,
  IStaffRoleExpiryNotifier,
} from "../services/staff/staff-role-expiry.service.js";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  timeZone: BUSINESS_TIME_ZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

type Notice = {
  readonly recipient: StaffNoticeRecipient;
  readonly audience: "person" | "administrator";
  readonly ended: EndedStaffRole;
};

/**
 * Tells a person their staff role ended, and every active administrator that it did: in the
 * product and by email. A person who is also an administrator gets only their own notice. Email
 * is keyed per role and recipient, so a repeat never sends twice; a failure for one recipient
 * does not stop the others.
 */
export class StaffRoleExpiryNotifier implements IStaffRoleExpiryNotifier {
  constructor(
    private readonly recipients: IStaffNoticeRecipientReader,
    private readonly dispatcher: Pick<NotificationDispatcher, "dispatch">,
    private readonly email: IEmailService,
    private readonly webOrigin: string,
  ) {}

  async notifyEnded(ended: readonly EndedStaffRole[], now: Date): Promise<void> {
    if (ended.length === 0) return;
    const [people, administrators] = await Promise.all([
      this.recipients.findByIds(ended.map((e) => e.userId)),
      this.recipients.listActiveAdministrators(now),
    ]);
    const person = new Map(people.map((p) => [p.id, p]));

    const notices: Notice[] = [];
    for (const e of ended) {
      const self = person.get(e.userId);
      if (self) notices.push({ recipient: self, audience: "person", ended: e });
      for (const admin of administrators) {
        if (admin.id === e.userId) continue;
        notices.push({ recipient: admin, audience: "administrator", ended: e });
      }
    }

    for (const notice of notices) {
      try {
        await this.send(notice, person.get(notice.ended.userId));
      } catch (err) {
        console.error("[StaffRoleExpiryNotifier] notice failed", {
          assignmentId: notice.ended.assignmentId,
          recipientId: notice.recipient.id,
          err,
        });
      }
    }
  }

  private async send(notice: Notice, subject: StaffNoticeRecipient | undefined): Promise<void> {
    const { recipient, audience, ended } = notice;
    const roleLabel = laxStaffRoleOption("bid", ended.role)?.label ?? ended.role;
    const endedOnDisplay = dateFormat.format(ended.endedAt);
    const staffName = subject?.name ?? "A team member";

    await this.dispatcher.dispatch(
      recipient.id,
      this.payload(audience, staffName, roleLabel, endedOnDisplay),
    );
    await this.email.enqueue({
      template: "staff-role-expired",
      to: recipient.email,
      userId: recipient.id,
      category: "transactional",
      idempotencyKey: `staff-role-expired:${ended.assignmentId}:${recipient.id}`,
      vars: {
        recipient: audience,
        recipientFirstName: recipient.firstName,
        staffName,
        roleLabel,
        endedOnDisplay,
        adminStaffAccessUrl:
          audience === "administrator" ? `${this.webOrigin}/admin/staff/access` : null,
      },
    });
  }

  private payload(
    audience: Notice["audience"],
    staffName: string,
    roleLabel: string,
    endedOnDisplay: string,
  ): NotificationPayload {
    return audience === "person"
      ? {
          type: "staff_role_expired",
          title: `Your ${roleLabel} role has ended`,
          message: `Your ${roleLabel} role on Bid ended on ${endedOnDisplay}. Ask an administrator if you still need it.`,
        }
      : {
          type: "staff_role_expired_admin",
          title: "A staff role has ended",
          message: `${staffName}'s ${roleLabel} role on Bid ended on ${endedOnDisplay}.`,
        };
  }
}
